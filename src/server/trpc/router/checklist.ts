import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { projectChecklistItems } from '@/db/schema/checklist';
import { projectEvents } from '@/db/schema/project-events';

export const checklistRouter = router({
  getForProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(({ input, ctx }) =>
      ctx.db
        .select()
        .from(projectChecklistItems)
        .where(eq(projectChecklistItems.projectId, input.projectId))
    ),

  toggle: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        stage: z.string(),
        key: z.string(),
        checked: z.boolean(),
      })
    )
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .insert(projectChecklistItems)
        .values({
          projectId: input.projectId,
          stage: input.stage,
          key: input.key,
          checked: input.checked,
          checkedAt: input.checked ? new Date() : null,
          checkedByUserId: input.checked ? ctx.user.id : null,
        })
        .onConflictDoUpdate({
          target: [
            projectChecklistItems.projectId,
            projectChecklistItems.stage,
            projectChecklistItems.key,
          ],
          set: {
            checked: input.checked,
            checkedAt: input.checked ? new Date() : null,
            checkedByUserId: input.checked ? ctx.user.id : null,
          },
        });
      await ctx.db.insert(projectEvents).values({
        projectId: input.projectId,
        actorUserId: ctx.user.id,
        eventType: 'checklist_toggled',
        payload: { stage: input.stage, key: input.key, checked: input.checked },
      });
      return { ok: true };
    }),
});
