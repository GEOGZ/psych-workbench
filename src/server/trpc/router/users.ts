import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { ownerOnly } from '../middleware';
import { users } from '@/db/schema/users';

const roleSchema = z.enum(['owner', 'admin', 'contractor']);

export const usersRouter = router({
  list: protectedProcedure
    .use(ownerOnly)
    .query(({ ctx }) =>
      ctx.db.query.users.findMany({
        columns: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: (u, { asc }) => [asc(u.createdAt)]
      })
    ),

  /**
   * Pre-create a user so they sign in with the correct role via magic link.
   * If the email already exists, updates their role instead.
   */
  invite: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ email: z.string().email(), role: roleSchema }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
        columns: { id: true }
      });

      if (existing) {
        const [row] = await ctx.db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, existing.id))
          .returning({ id: users.id, email: users.email, role: users.role });
        return { action: 'updated' as const, user: row };
      }

      const [row] = await ctx.db
        .insert(users)
        .values({ email: input.email, role: input.role, invitedByUserId: ctx.user.id })
        .returning({ id: users.id, email: users.email, role: users.role });
      return { action: 'created' as const, user: row };
    }),

  setRole: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ userId: z.string().uuid(), role: roleSchema }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能修改自己的角色' });
      }
      const [row] = await ctx.db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id, email: users.email, role: users.role });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  delete: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能删除自己的账号' });
      }
      await ctx.db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    })
});
