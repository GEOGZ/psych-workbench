import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { assessmentTools } from '@/db/schema/assessment-tools';

export const assessmentToolsRouter = router({
  list: protectedProcedure
    .use(adminOrOwner)
    .query(({ ctx }) =>
      ctx.db.query.assessmentTools.findMany({
        orderBy: (t, { asc }) => [asc(t.category), asc(t.name)],
      })
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(adminOrOwner)
    .query(async ({ input, ctx }) => {
      const tool = await ctx.db.query.assessmentTools.findFirst({
        where: eq(assessmentTools.id, input.id),
      });
      if (!tool) throw new TRPCError({ code: 'NOT_FOUND' });
      return tool;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
    }))
    .use(adminOrOwner)
    .mutation(({ input, ctx }) =>
      ctx.db.insert(assessmentTools).values({
        ...input,
        ownerUserId: ctx.user.id,
      }).returning()
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      category: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
    }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const [row] = await ctx.db
        .update(assessmentTools)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(assessmentTools.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(assessmentTools).where(eq(assessmentTools.id, input.id));
      return { success: true };
    }),
});
