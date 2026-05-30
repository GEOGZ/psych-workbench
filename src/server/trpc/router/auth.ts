import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { ownerOnly } from '../middleware';
import { users } from '@/db/schema/users';
import { validatePassword, hashPassword } from '@/lib/password';
import { mailer } from '@/server/email/mailer';

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

  /** Public — user requests password reset from login page.
   *  Sets mustChangePassword=true then sends a plain email directing
   *  the user to log in via magic-link; the layout guard will then
   *  redirect them to /change-password automatically.
   *  Always returns success to prevent email enumeration.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase().trim()),
        columns: { id: true, name: true, email: true },
      });

      if (user) {
        await ctx.db.update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, user.id));

        const base = process.env.NEXTAUTH_URL ?? process.env.PORTAL_BASE_URL ?? 'http://localhost:3000';
        await mailer.sendMail({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: '重置您的登录密码',
          html: `<p>您好${user.name ? `，${user.name}` : ''}，</p>
<p>我们收到了您的密码重置请求。请点击下方链接，使用<strong>魔法链接</strong>方式登录，系统将自动引导您设置新密码。</p>
<p><a href="${base}/login" style="color:#4a4af0;font-weight:bold;">${base}/login</a></p>
<p>如果您没有发起此请求，请忽略此邮件。</p>`,
          text: `您好${user.name ? `，${user.name}` : ''}，\n\n请访问 ${base}/login，选择"魔法链接登录"，登录后系统将自动引导您设置新密码。\n\n如未发起此请求请忽略。`,
        });
      }

      return { success: true };
    }),
});
