import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { ownerOnly } from '../middleware';
import { users } from '@/db/schema/users';
import { validatePassword, hashPassword } from '@/lib/password';

export const authRouter = router({
  changePassword: protectedProcedure
    .input(z.object({ newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const { valid, message } = validatePassword(input.newPassword);
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message });
      const hash = await hashPassword(input.newPassword);
      await ctx.db.update(users)
        .set({ passwordHash: hash, mustChangePassword: false })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  setUserPassword: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ userId: z.string().uuid(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const { valid, message } = validatePassword(input.newPassword);
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message });
      const hash = await hashPassword(input.newPassword);
      const [row] = await ctx.db.update(users)
        .set({ passwordHash: hash, mustChangePassword: false })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  resetPassword: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await ctx.db.update(users)
        .set({ mustChangePassword: true })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  /**
   * Public — marks the account for forced password change.
   * The caller (login page) then triggers signIn('email', { callbackUrl: '/change-password' })
   * so NextAuth generates and sends the real magic-link email.
   * Always returns success to prevent email enumeration.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase().trim()),
        columns: { id: true },
      });
      if (user) {
        await ctx.db.update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, user.id));
      }
      return { success: true };
    }),
});
