import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { users } from '@/db/schema/users';
import { hatLogs } from '@/db/schema/hat-logs';

beforeAll(setupTestDb, 60_000);
afterAll(teardownTestDb);

describe('hat_logs GiST exclusion constraint', () => {
  it('rejects overlapping intervals for same user', async () => {
    const db = getDb();

    // Create user
    await db.insert(users).values({ email: 'h@x.com', role: 'owner' });
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, 'h@x.com') });

    if (!user) throw new Error('User not created');

    // Insert first hat log
    await db.insert(hatLogs).values({
      userId: user.id,
      hat: '🛠',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: new Date('2026-05-23T11:00:00Z'),
      source: 'manual'
    });

    // Expect second overlapping hat to be rejected
    await expect(
      db.insert(hatLogs).values({
        userId: user.id,
        hat: '🧠',
        startAt: new Date('2026-05-23T10:30:00Z'),
        endAt: new Date('2026-05-23T12:00:00Z'),
        source: 'manual'
      })
    ).rejects.toThrow(/exclusion|overlap|hat_logs_no_overlap/i);
  });

  it('allows back-to-back intervals (boundary touching)', async () => {
    const db = getDb();

    // Create different user
    await db.insert(users).values({ email: 'h2@x.com', role: 'owner' });
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, 'h2@x.com') });

    if (!user) throw new Error('User not created');

    // Insert first hat log ending at 11:00
    await db.insert(hatLogs).values({
      userId: user.id,
      hat: '🎩',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: new Date('2026-05-23T11:00:00Z'),
      source: 'manual'
    });

    // Expect second hat starting exactly at 11:00 to resolve (half-open [) semantics)
    await expect(
      db.insert(hatLogs).values({
        userId: user.id,
        hat: '📊',
        startAt: new Date('2026-05-23T11:00:00Z'),
        endAt: new Date('2026-05-23T12:00:00Z'),
        source: 'manual'
      })
    ).resolves.not.toThrow();
  });

  it('rejects new open interval when an open interval already exists', async () => {
    const db = getDb();

    // Create different user
    await db.insert(users).values({ email: 'h3@x.com', role: 'owner' });
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, 'h3@x.com') });

    if (!user) throw new Error('User not created');

    // Insert open interval (currently wearing)
    await db.insert(hatLogs).values({
      userId: user.id,
      hat: '🧠',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: null,
      source: 'manual'
    });

    // Expect second open interval to be rejected
    await expect(
      db.insert(hatLogs).values({
        userId: user.id,
        hat: '🎩',
        startAt: new Date('2026-05-23T10:00:00Z'),
        endAt: null,
        source: 'manual'
      })
    ).rejects.toThrow(/exclusion|overlap/i);
  });
});
