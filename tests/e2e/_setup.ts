import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, like } from 'drizzle-orm';
import type { BrowserContext } from '@playwright/test';
import {
  users,
  sessions,
  clients,
  projects,
  clientPortalTokens,
} from '../../src/db/schema';
import type { UserRole } from '../../src/db/schema/users';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const testDb = drizzle(pool, {
  schema: { users, sessions, clients, projects, clientPortalTokens },
});

const E2E_EMAIL_SUFFIX = '@e2e.test.local';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export async function seedUser(role: UserRole): Promise<typeof users.$inferSelect> {
  const email = `e2e-${role}${E2E_EMAIL_SUFFIX}`;
  const existing = await testDb.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    const [updated] = await testDb
      .update(users)
      .set({ role })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }
  const [user] = await testDb
    .insert(users)
    .values({ email, role, name: `E2E ${role}` })
    .returning();
  return user!;
}

export async function loginAs(
  context: BrowserContext,
  role: UserRole,
): Promise<typeof users.$inferSelect> {
  const user = await seedUser(role);
  const sessionToken = `e2e-${role}-${Date.now()}`;
  const expires = new Date(Date.now() + SESSION_EXPIRY_MS);

  await testDb.insert(sessions).values({ sessionToken, userId: user.id, expires });

  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_MS / 1000,
    },
  ]);

  return user;
}

export async function seedClientAndProject(ownerUserId?: string) {
  const resolvedOwnerId = ownerUserId ?? (await seedUser('owner')).id;

  const [client] = await testDb
    .insert(clients)
    .values({
      name: 'E2E Test Corp',
      contactName: 'E2E Contact',
      contactEmail: 'contact@e2e.test.local',
      crisisContactName: 'E2E Emergency',
      crisisContactPhone: '+86-138-0000-0001',
    })
    .returning();

  const [project] = await testDb
    .insert(projects)
    .values({
      clientId: client!.id,
      ownerUserId: resolvedOwnerId,
      title: 'E2E Test Project',
      state: 'lead',
    })
    .returning();

  return { client: client!, project: project! };
}

export async function seedPortalToken(clientId: string): Promise<string> {
  const token = 'e2e' + '0'.repeat(60); // fixed 64-char token for testing
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  await testDb
    .insert(clientPortalTokens)
    .values({ clientId, token, expiresAt })
    .onConflictDoNothing();

  return token;
}

export async function cleanupE2EData() {
  const e2eClients = await testDb.query.clients.findMany({
    where: like(clients.contactEmail, '%@e2e.test.local'),
  });

  for (const c of e2eClients) {
    await testDb.delete(clientPortalTokens).where(eq(clientPortalTokens.clientId, c.id));
    await testDb.delete(projects).where(eq(projects.clientId, c.id));
    await testDb.delete(clients).where(eq(clients.id, c.id));
  }

  const e2eUsers = await testDb.query.users.findMany({
    where: like(users.email, `%${E2E_EMAIL_SUFFIX}`),
  });

  for (const u of e2eUsers) {
    await testDb.delete(sessions).where(eq(sessions.userId, u.id));
    await testDb.delete(users).where(eq(users.id, u.id));
  }
}
