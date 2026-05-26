import { z } from 'zod';
import { and, eq, ne, count, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner, contractorScoped } from '../middleware';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';
import { clientEvents } from '@/db/schema/client-events';

/**
 * RED-LINE SECURITY (§4.3 "不外包客户关系"):
 * Contractors NEVER see: crisis contact name/phone, full contact phone, notes.
 * Only public fields exposed: id, name, contactName.
 */

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  contactName: true
} as const;

const FULL_FIELDS = {
  id: true,
  name: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  crisisContactName: true,
  crisisContactPhone: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} as const;

export const clientsRouter = router({
  /**
   * List all clients (admin/owner only, full fields).
   */
  list: protectedProcedure.use(adminOrOwner).query(({ ctx }) =>
    ctx.db.query.clients.findMany({ columns: FULL_FIELDS })
  ),

  /**
   * Get client by ID (admin/owner only, full record).
   */
  getById: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(({ input, ctx }) =>
      ctx.db.query.clients.findFirst({
        where: eq(clients.id, input.clientId),
        columns: FULL_FIELDS
      })
    ),

  /**
   * Get client by ID for contractor (RED-LINE: PUBLIC_FIELDS only).
   * Requires projectId and valid contractor grant.
   * Never exposes: contactEmail, contactPhone, crisisContactName, crisisContactPhone, notes.
   */
  getByIdForContractor: protectedProcedure
    .input(z.object({ clientId: z.string().uuid(), projectId: z.string().uuid() }))
    .use(contractorScoped)
    .query(({ input, ctx }) =>
      ctx.db.query.clients.findFirst({
        where: eq(clients.id, input.clientId),
        columns: PUBLIC_FIELDS
      })
    ),

  /**
   * Create a new client (admin/owner only).
   * Validates required crisis contact info (§4.3).
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        crisisContactName: z.string().min(1, '紧急联系人姓名必填'),
        crisisContactPhone: z.string().min(1, '紧急联系电话必填'),
        notes: z.string().optional()
      })
    )
    .use(adminOrOwner)
    .mutation(({ input, ctx }) => ctx.db.insert(clients).values(input).returning()),

  update: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        name: z.string().min(1).optional(),
        contactName: z.string().min(1).optional(),
        contactEmail: z.string().email().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
        crisisContactName: z.string().min(1).optional(),
        crisisContactPhone: z.string().min(1).optional(),
        notes: z.string().nullable().optional()
      })
    )
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const { clientId, ...fields } = input;
      const [row] = await ctx.db
        .update(clients)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(clients.id, clientId))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      try {
        await ctx.db.insert(clientEvents).values({
          clientId,
          actorUserId: ctx.user.id,
          eventType: 'client_updated',
          payload: fields as Record<string, unknown>
        });
      } catch {}
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const active = await ctx.db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.clientId, input.clientId), ne(projects.state, 'done')));
      if ((active[0]?.value ?? 0) > 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '该客户有活跃项目，无法删除' });
      }
      const any = await ctx.db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.clientId, input.clientId));
      if ((any[0]?.value ?? 0) > 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '该客户存在已完成项目记录，无法删除（保留历史数据）' });
      }
      await ctx.db.delete(clients).where(eq(clients.id, input.clientId));
      return { success: true };
    }),

  listEvents: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(({ input, ctx }) =>
      ctx.db
        .select()
        .from(clientEvents)
        .where(eq(clientEvents.clientId, input.clientId))
        .orderBy(desc(clientEvents.at))
        .limit(50)
    )
});
