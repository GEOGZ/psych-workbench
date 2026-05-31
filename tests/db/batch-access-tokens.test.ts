import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { assessmentBatches, batchAccessTokens } from '@/db/schema';
import { users } from '@/db/schema/users';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';

async function seedBatch() {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email: `u-${Date.now()}@test.com`, role: 'owner' })
    .returning();
  const [client] = await db
    .insert(clients)
    .values({
      name: 'TestClient',
      createdBy: user.id,
      crisisContactName: 'Crisis Person',
      crisisContactPhone: '13900000001',
    })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({
      clientId: client.id,
      name: 'TestProject',
      status: 'execution',
      createdBy: user.id,
    })
    .returning();
  const [batch] = await db
    .insert(assessmentBatches)
    .values({
      name: 'Batch-001',
      projectId: project.id,
      projectContactName: 'PM Zhang',
      projectContactPhone: '13800000001',
      crisisContactName: 'Crisis Li',
      crisisContactPhone: '13800000002',
    })
    .returning();
  return { user, client, project, batch };
}

describe('batch_access_tokens schema', () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.warn('SKIP: TEST_DATABASE_URL not set');
      return;
    }
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('inserts a token linked to a batch', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [tok] = await db
      .insert(batchAccessTokens)
      .values({ batchId: batch.id, token: 'tok-abc-001' })
      .returning();

    expect(tok.id).toBeDefined();
    expect(tok.batchId).toBe(batch.id);
    expect(tok.token).toBe('tok-abc-001');
    expect(tok.isActive).toBe(true);
    expect(tok.expiresAt).toBeNull();
  });

  it('isActive defaults to true', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [tok] = await db
      .insert(batchAccessTokens)
      .values({ batchId: batch.id, token: `tok-${Date.now()}` })
      .returning();

    expect(tok.isActive).toBe(true);
  });

  it('rejects duplicate token (UNIQUE constraint)', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();
    const uniqueToken = `tok-dup-${Date.now()}`;

    await db.insert(batchAccessTokens).values({ batchId: batch.id, token: uniqueToken });

    await expect(
      db.insert(batchAccessTokens).values({ batchId: batch.id, token: uniqueToken })
    ).rejects.toThrow();
  });

  it('rejects null token', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    await expect(
      db.execute(
        `INSERT INTO batch_access_tokens (batch_id, token) VALUES ('${batch.id}', NULL)` as never
      )
    ).rejects.toThrow();
  });

  it('rejects null batchId', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();

    await expect(
      db.execute(
        `INSERT INTO batch_access_tokens (batch_id, token) VALUES (NULL, 'tok-x')` as never
      )
    ).rejects.toThrow();
  });

  it('can deactivate a token', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [tok] = await db
      .insert(batchAccessTokens)
      .values({ batchId: batch.id, token: `tok-deact-${Date.now()}` })
      .returning();

    const [updated] = await db
      .update(batchAccessTokens)
      .set({ isActive: false })
      .where(eq(batchAccessTokens.id, tok.id))
      .returning();

    expect(updated.isActive).toBe(false);
  });

  it('stores expiresAt when provided', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [tok] = await db
      .insert(batchAccessTokens)
      .values({ batchId: batch.id, token: `tok-exp-${Date.now()}`, expiresAt })
      .returning();

    expect(tok.expiresAt).not.toBeNull();
  });
});
