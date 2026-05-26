import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { jobProfiles } from '@/db/schema/job-profiles';

const competencySchema = z.object({
  dimension: z.string().min(1),
  weight: z.number().min(0).max(100).optional(),
});

export const jobProfilesRouter = router({
  list: protectedProcedure
    .use(adminOrOwner)
    .query(({ ctx }) =>
      ctx.db.query.jobProfiles.findMany({
        orderBy: (jp, { asc }) => [asc(jp.name)],
      })
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(adminOrOwner)
    .query(async ({ input, ctx }) => {
      const jp = await ctx.db.query.jobProfiles.findFirst({
        where: eq(jobProfiles.id, input.id),
      });
      if (!jp) throw new TRPCError({ code: 'NOT_FOUND' });
      return jp;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      department: z.string().optional(),
      competencies: z.array(competencySchema).default([]),
      tools: z.array(z.string()).default([]),
      notes: z.string().optional(),
    }))
    .use(adminOrOwner)
    .mutation(({ input, ctx }) =>
      ctx.db.insert(jobProfiles).values({
        ...input,
        ownerUserId: ctx.user.id,
      }).returning()
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      department: z.string().nullable().optional(),
      competencies: z.array(competencySchema).optional(),
      tools: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const [row] = await ctx.db
        .update(jobProfiles)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(jobProfiles.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(jobProfiles).where(eq(jobProfiles.id, input.id));
      return { success: true };
    }),
});
