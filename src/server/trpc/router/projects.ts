import { z } from 'zod';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner, contractorScoped } from '../middleware';
import { projects, type ProjectState } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { clients } from '@/db/schema/clients';
import { projectChecklistItems } from '@/db/schema/checklist';
import { advanceProject } from '@/server/state/advance';

const projectStateSchema = z.enum([
  'lead',
  'qualifying',
  'discovery',
  'contract',
  'execution',
  'reporting',
  'closing',
  'done'
]) as z.ZodType<ProjectState>;

export const projectsRouter = router({
  list: protectedProcedure.use(adminOrOwner).query(({ ctx }) =>
    ctx.db.query.projects.findMany({
      orderBy: (p, { desc }) => [desc(p.updatedAt)]
    })
  ),

  listByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(({ input, ctx }) =>
      ctx.db.query.projects.findMany({
        where: eq(projects.clientId, input.clientId),
        orderBy: (p, { desc }) => [desc(p.updatedAt)]
      })
    ),

  getById: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(contractorScoped)
    .query(({ input, ctx }) =>
      ctx.db.query.projects.findFirst({ where: eq(projects.id, input.projectId) })
    ),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        title: z.string().min(1),
        notes: z.string().optional()
      })
    )
    .use(adminOrOwner)
    .mutation(({ input, ctx }) =>
      ctx.db.insert(projects).values({ ...input, ownerUserId: ctx.user.id }).returning()
    ),

  updateStageMeta: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), stageMeta: z.record(z.unknown()) }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const current = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { state: true, stageMeta: true }
      });

      let mergedMeta: Record<string, unknown> = { ...input.stageMeta };

      if (current?.state === 'discovery') {
        const dr = typeof mergedMeta.discountRate === 'number' ? mergedMeta.discountRate : null;
        const existingSince = (current.stageMeta as Record<string, unknown> | null)?._discountCoolingSince;
        if (dr !== null && dr >= 70 && dr < 85) {
          mergedMeta._discountCoolingSince = existingSince ?? new Date().toISOString();
        } else {
          delete mergedMeta._discountCoolingSince;
        }
      }

      const [updated] = await ctx.db.update(projects)
        .set({ stageMeta: mergedMeta, updatedAt: new Date() })
        .where(eq(projects.id, input.projectId))
        .returning();
      await ctx.db.insert(projectEvents).values({
        projectId: input.projectId,
        actorUserId: ctx.user.id,
        eventType: 'stage_meta_updated',
        payload: { stage: updated?.state ?? 'unknown' },
      });
      return updated;
    }),

  listEvents: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(contractorScoped)
    .query(({ input, ctx }) =>
      ctx.db
        .select()
        .from(projectEvents)
        .where(eq(projectEvents.projectId, input.projectId))
        .orderBy(desc(projectEvents.at))
        .limit(50)
    ),

  advance: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        toState: projectStateSchema,
        note: z.string().optional(),
        revert: z.boolean().optional()
      })
    )
    .use(contractorScoped)
    .mutation(({ input, ctx }) =>
      advanceProject(input.projectId, input.toState, ctx.user.id, input.note, input.revert)
    ),

  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).optional(),
        notes: z.string().nullable().optional()
      })
    )
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const { projectId, ...fields } = input;
      const [row] = await ctx.db
        .update(projects)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      try {
        await ctx.db.insert(projectEvents).values({
          projectId,
          actorUserId: ctx.user.id,
          eventType: 'project_updated',
          payload: fields as Record<string, unknown>
        });
      } catch {}
      return row;
    }),

  addNote: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), content: z.string().min(1).max(2000) }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.insert(projectEvents).values({
        projectId: input.projectId,
        actorUserId: ctx.user.id,
        eventType: 'note_added',
        payload: { content: input.content }
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { id: true, state: true }
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.state !== 'lead') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '仅「线索」阶段的项目可以删除' });
      }
      await ctx.db.delete(projects).where(eq(projects.id, input.projectId));
      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .use(adminOrOwner)
    .query(async ({ input, ctx }) => {
      const term = `%${input.q}%`;
      const [matchedProjects, matchedClients] = await Promise.all([
        ctx.db.query.projects.findMany({
          where: ilike(projects.title, term),
          columns: { id: true, title: true, state: true },
          limit: 5
        }),
        ctx.db.query.clients.findMany({
          where: or(ilike(clients.name, term), ilike(clients.contactName, term)),
          columns: { id: true, name: true, contactName: true },
          limit: 5
        })
      ]);
      return { projects: matchedProjects, clients: matchedClients };
    }),

  getFullReport: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(async ({ input, ctx }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId)
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      const [client, events, checklistItems] = await Promise.all([
        ctx.db.query.clients.findFirst({ where: eq(clients.id, project.clientId) }),
        ctx.db.select().from(projectEvents)
          .where(eq(projectEvents.projectId, input.projectId))
          .orderBy(desc(projectEvents.at)),
        ctx.db.select().from(projectChecklistItems)
          .where(eq(projectChecklistItems.projectId, input.projectId))
      ]);
      return { project, client: client ?? null, events, checklistItems };
    }),

  addMonthlyRetrospective: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      content: z.string().min(1).max(3000)
    }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.insert(projectEvents).values({
        projectId: input.projectId,
        actorUserId: ctx.user.id,
        eventType: 'monthly_retrospective',
        payload: { month: input.month, content: input.content }
      });
      return { success: true };
    }),

  listMonthlyRetrospectives: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(contractorScoped)
    .query(({ input, ctx }) =>
      ctx.db
        .select()
        .from(projectEvents)
        .where(and(
          eq(projectEvents.projectId, input.projectId),
          eq(projectEvents.eventType, 'monthly_retrospective')
        ))
        .orderBy(desc(projectEvents.at))
        .limit(24)
    ),

  listReceivables: protectedProcedure
    .use(adminOrOwner)
    .query(({ ctx }) =>
      ctx.db
        .select({
          id: projects.id,
          title: projects.title,
          state: projects.state,
          stageMeta: projects.stageMeta,
        })
        .from(projects)
        .where(
          or(
            sql`${projects.stageMeta}->>'finalPaymentStatus' LIKE 'pending%'`,
            sql`${projects.stageMeta}->>'finalPaymentStatus' LIKE 'partial%'`
          )
        )
        .orderBy(sql`${projects.stageMeta}->>'paymentDueDate' ASC NULLS LAST`)
    ),

  setJobProfile: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), jobProfileId: z.string().uuid().nullable() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const [row] = await ctx.db
        .update(projects)
        .set({ jobProfileId: input.jobProfileId, updatedAt: new Date() })
        .where(eq(projects.id, input.projectId))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  listFollowUpAlerts: protectedProcedure
    .use(adminOrOwner)
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ id: projects.id, title: projects.title, state: projects.state, stageMeta: projects.stageMeta, updatedAt: projects.updatedAt })
        .from(projects)
        .where(sql`${projects.state} NOT IN ('done', 'closing')`);

      const now = Date.now();
      const staleThresholdMs = 14 * 24 * 3600 * 1000;

      return rows.flatMap(p => {
        const meta = (p.stageMeta ?? {}) as Record<string, unknown>;
        const alerts: { projectId: string; title: string; type: 'cooling' | 'stale'; detail: string }[] = [];

        if (p.state === 'discovery' && typeof meta._discountCoolingSince === 'string') {
          const elapsed = now - new Date(meta._discountCoolingSince).getTime();
          const remainH = Math.ceil((24 * 3600 * 1000 - elapsed) / 3600000);
          if (remainH > 0) {
            alerts.push({ projectId: p.id, title: p.title, type: 'cooling', detail: `折扣冷静期，还需约 ${remainH} 小时方可推进` });
          }
        }

        const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : (p.updatedAt as Date).toISOString();
        if (now - new Date(updatedAt).getTime() > staleThresholdMs) {
          alerts.push({ projectId: p.id, title: p.title, type: 'stale', detail: `已 ${Math.floor((now - new Date(updatedAt).getTime()) / 86400000)} 天未更新` });
        }

        return alerts;
      });
    }),
});
