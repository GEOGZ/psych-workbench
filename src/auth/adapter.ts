import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';
import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@/db';
import { accounts, sessions, verificationTokens, users } from '@/db/schema';

export function createDrizzleAdapter(db: DbClient): Adapter {
  return {
    async createUser(data: { email: string; emailVerified: Date | null; name?: string | null; image?: string | null }) {
      const [user] = await db
        .insert(users)
        .values({
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          image: data.image,
          role: 'contractor', // Default role for new users
        })
        .returning();

      if (!user) {
        throw new Error('Failed to create user');
      }

      return userToAdapterUser(user);
    },

    async getUser(id) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });

      return user ? userToAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      return user ? userToAdapterUser(user) : null;
    },

    async getUserByAccount(provider_providerAccountId) {
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.provider, provider_providerAccountId.provider),
          eq(accounts.providerAccountId, provider_providerAccountId.providerAccountId)
        ),
      });

      if (!account) {
        return null;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, account.userId),
      });

      return user ? userToAdapterUser(user) : null;
    },

    async updateUser(data) {
      const [user] = await db
        .update(users)
        .set({
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          image: data.image,
        })
        .where(eq(users.id, data.id))
        .returning();

      if (!user) {
        throw new Error('Failed to update user');
      }

      return userToAdapterUser(user);
    },

    async deleteUser(id) {
      await db.delete(users).where(eq(users.id, id));
    },

    async linkAccount(data: AdapterAccount) {
      await db.insert(accounts).values({
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refreshToken: data.refresh_token,
        accessToken: data.access_token,
        expiresAt: data.expires_at,
        tokenType: data.token_type,
        scope: data.scope,
        idToken: data.id_token,
        sessionState: data.session_state,
      });
    },

    async unlinkAccount(provider_providerAccountId) {
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.provider, provider_providerAccountId.provider),
            eq(accounts.providerAccountId, provider_providerAccountId.providerAccountId)
          )
        );
    },

    async createSession(data) {
      const [session] = await db
        .insert(sessions)
        .values({
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        })
        .returning();

      if (!session) {
        throw new Error('Failed to create session');
      }

      return sessionToAdapterSession(session);
    },

    async getSessionAndUser(sessionToken) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, sessionToken),
      });

      if (!session) {
        return null;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
      });

      if (!user) {
        return null;
      }

      return {
        session: sessionToAdapterSession(session),
        user: userToAdapterUser(user),
      };
    },

    async updateSession(data) {
      const [session] = await db
        .update(sessions)
        .set({
          expires: data.expires,
        })
        .where(eq(sessions.sessionToken, data.sessionToken))
        .returning();

      if (!session) {
        return null;
      }

      return sessionToAdapterSession(session);
    },

    async deleteSession(sessionToken) {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    },

    async createVerificationToken(data: VerificationToken) {
      const [token] = await db.insert(verificationTokens).values({
        identifier: data.identifier,
        token: data.token,
        expires: data.expires,
      }).returning();
      return token ?? null;
    },

    async useVerificationToken(identifier_token) {
      const verificationToken = await db.query.verificationTokens.findFirst({
        where: and(
          eq(verificationTokens.identifier, identifier_token.identifier),
          eq(verificationTokens.token, identifier_token.token)
        ),
      });

      if (!verificationToken) {
        return null;
      }

      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier_token.identifier),
            eq(verificationTokens.token, identifier_token.token)
          )
        );

      return verificationToken;
    },
  };
}

// Helper functions to convert between Drizzle and NextAuth shapes

function userToAdapterUser(user: any): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}

function sessionToAdapterSession(session: any): AdapterSession {
  return {
    sessionToken: session.sessionToken,
    userId: session.userId,
    expires: session.expires,
  };
}
