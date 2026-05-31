import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { sampleIds } from '@/db/schema/sample-ids';
import { assessmentBatches } from '@/db/schema/assessment-batches';
import { projects } from '@/db/schema/projects';
import { clients } from '@/db/schema/clients';
import { users } from '@/db/schema/users';

beforeAll(setupTestDb, 60_000);
afterAll(teardownTestDb);

async function seedBatch() {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email: `u-${Date.now()}@test.com`, role: 'owner', name: 'Owner' })
    .returning();
  const [client] = await db
    .insert(clients)
    .values({
      name: 'Test Client',
      contactName: 'Bob',
      crisisContactName: 'EC',
      crisisContactPhone: '555-0000'
    })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({
      title: 'Test Project',
      clientId: client!.id,
      ownerUserId: user!.id,
      state: 'execution'
    })
    .returning();
  const [batch] = await db
    .insert(assessmentBatches)
    .values({
      name: 'Test Batch',
      projectId: project!.id,
      projectContactName: 'PM',
      projectContactPhone: '555',
      crisisContactName: 'EC',
      crisisContactPhone: '555'
    })
    .returning();
  return batch!.id;
}

describe('sample_ids schema constraints', () => {
  it('rejects insert when code is null', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO sample_ids (batch_id, code)
            VALUES (gen_random_uuid(), NULL)`
      )
    ).rejects.toThrow(/null value.*code/i);
  });

  it('rejects duplicate code within same batch', async () => {
    const db = getDb();
    const batchId = await seedBatch();
    await db.insert(sampleIds).values({ batchId, code: 'DUPE-001' });
    await expect(
      db.insert(sampleIds).values({ batchId, code: 'DUPE-001' })
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('accepts valid sample with required fields', async () => {
    const db = getDb();
    const batchId = await seedBatch();
    const [sample] = await db
      .insert(sampleIds)
      .values({ batchId, code: `S-${Date.now()}` })
      .returning();
    expect(sample?.id).toBeTruthy();
    expect(sample?.status).toBe('pending');
  });

  it('defaults status to pending', async () => {
    const db = getDb();
    const batchId = await seedBatch();
    const [sample] = await db
      .insert(sampleIds)
      .values({ batchId, code: `DEF-${Date.now()}` })
      .returning();
    expect(sample?.status).toBe('pending');
  });

  it('rejects invalid status value', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO sample_ids (batch_id, code, status)
            VALUES (gen_random_uuid(), 'BAD-STATUS-TEST', 'invalid_status')`
      )
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('enforces zero-PII: no name column exists', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO sample_ids (batch_id, code, name)
            VALUES (gen_random_uuid(), 'PII-TEST', 'Alice')`
      )
    ).rejects.toThrow(/column.*name.*does not exist/i);
  });
});
