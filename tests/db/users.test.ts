import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { users } from '@/db/schema/users';

beforeAll(setupTestDb, 60_000);
afterAll(teardownTestDb);

describe('users single-owner constraint', () => {
  it('rejects a second owner', async () => {
    const db = getDb();
    await db.insert(users).values({ email: 'a@x.com', role: 'owner' });
    await expect(
      db.insert(users).values({ email: 'b@x.com', role: 'owner' })
    ).rejects.toThrow(/unique|duplicate|users_single_owner/i);
  });

  it('allows transferring ownership when previous owner is demoted first', async () => {
    const db = getDb();
    // Pre-existing owner from previous test (a@x.com). Demote it, then insert a new owner.
    await db.update(users).set({ role: 'admin' }).where(eq(users.email, 'a@x.com'));
    await expect(
      db.insert(users).values({ email: 'c@x.com', role: 'owner' })
    ).resolves.not.toThrow();
  });
});
