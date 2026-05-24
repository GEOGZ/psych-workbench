import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner, contractorScoped } from '../middleware';
import { projects, type ProjectState } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
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
      const [updated] = await ctx.db.update(projects)
        .set({ stageMeta: input.stageMeta, updatedAt: new Date() })
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
    })
});
