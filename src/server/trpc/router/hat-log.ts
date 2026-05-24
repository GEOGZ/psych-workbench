import { z } from 'zod';
import { and, eq, isNull, desc, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { hatLogs, type HatType } from '@/db/schema/hat-logs';

const hatEnum = z.enum(['🎩', '🧠', '🛠', '📊']) as z.ZodType<HatType>;

export const hatLogRouter = router({
  /**
   * Get current hat (the open interval with endAt IS NULL).
   */
  current: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.hatLogs.findFirst({
      where: and(
        eq(hatLogs.userId, ctx.user.id),
        isNull(hatLogs.endAt)
      ),
      orderBy: [desc(hatLogs.startAt)]
    })
  ),

  /**
   * Get all hat logs for a given date (for the today widget).
   */
  forDate: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(({ input, ctx }) => {
      const start = new Date(`${input.date}T00:00:00Z`);
      const end = new Date(`${input.date}T23:59:59.999Z`);
      return ctx.db.query.hatLogs.findMany({
        where: and(
          eq(hatLogs.userId, ctx.user.id),
          gte(hatLogs.startAt, start),
          lte(hatLogs.startAt, end)
        ),
        orderBy: [desc(hatLogs.startAt)]
      });
    }),

  /**
   * Switch to a different hat.
   * Closes the current open interval (if any) and opens a new one.
   * Both writes happen in the same transaction — the GiST exclusion
   * constraint validates the result atomically at commit.
   */
  switchHat: protectedProcedure
    .input(
      z.object({
        hat: hatEnum,
        projectId: z.string().uuid().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        // Close current open interval
        await tx
          .update(hatLogs)
          .set({ endAt: now })
          .where(and(eq(hatLogs.userId, ctx.user.id), isNull(hatLogs.endAt)));

        // Open new interval
        const [newLog] = await tx
          .insert(hatLogs)
          .values({
            userId: ctx.user.id,
            hat: input.hat,
            projectId: input.projectId ?? null,
            startAt: now,
            endAt: null,
            source: 'manual'
          })
          .returning();

        return newLog;
      });
    }),

  /**
   * Take off current hat (close without opening a new one).
   * No-op if nothing is currently being worn.
   */
  removeHat: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    await ctx.db
      .update(hatLogs)
      .set({ endAt: now })
      .where(and(eq(hatLogs.userId, ctx.user.id), isNull(hatLogs.endAt)));
    return { ok: true };
  }),

  /**
   * Backfill a past time block.
   * The GiST exclusion constraint (DB-level) rejects overlapping intervals.
   */
  backfill: protectedProcedure
    .input(
      z.object({
        hat: hatEnum,
        projectId: z.string().uuid().optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime()
      })
        .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
          message: 'endAt must be after startAt'
        })
    )
    .mutation(async ({ input, ctx }) => {
      const [log] = await ctx.db
        .insert(hatLogs)
        .values({
          userId: ctx.user.id,
          hat: input.hat,
          projectId: input.projectId ?? null,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          source: 'backfill'
        })
        .returning();

      if (!log) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no rows' });
      }
      return log;
    })
});
