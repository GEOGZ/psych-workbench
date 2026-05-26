import type { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createDrizzleAdapter } from './adapter';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema/users';
import { verifyPassword } from '@/lib/password';

export const authOptions: NextAuthOptions = {
  adapter: createDrizzleAdapter(db),
  providers: [
    CredentialsProvider({
      name: 'password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email.toLowerCase().trim()),
          columns: { id: true, email: true, name: true, role: true, passwordHash: true, mustChangePassword: true },
        });
        if (!user) return null;
        if (!user.passwordHash) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        } as any;
      },
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
        secure: process.env.EMAIL_SERVER_SECURE !== 'false',
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        (session.user as any).role = (user as any).role;
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { mustChangePassword: true },
        });
        (session.user as any).mustChangePassword = dbUser?.mustChangePassword ?? false;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));
      }
    },
  },
};
