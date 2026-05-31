import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { assessmentBatches, batchReports } from '@/db/schema';
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

describe('batch_reports schema', () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      console.warn('SKIP: TEST_DATABASE_URL not set');
      return;
    }
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('inserts a draft report linked to a batch', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [report] = await db
      .insert(batchReports)
      .values({ batchId: batch.id })
      .returning();

    expect(report.id).toBeDefined();
    expect(report.batchId).toBe(batch.id);
    expect(report.status).toBe('draft');
    expect(report.reportFileUrl).toBeNull();
    expect(report.reviewNote).toBeNull();
    expect(report.publishedAt).toBeNull();
  });

  it('status defaults to draft', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [report] = await db
      .insert(batchReports)
      .values({ batchId: batch.id })
      .returning();

    expect(report.status).toBe('draft');
  });

  it('rejects invalid status enum value', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    await expect(
      db.execute(
        `INSERT INTO batch_reports (batch_id, status) VALUES ('${batch.id}', 'approved')` as never
      )
    ).rejects.toThrow();
  });

  it('transitions to pending_review with review note', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [report] = await db
      .insert(batchReports)
      .values({ batchId: batch.id })
      .returning();

    const [updated] = await db
      .update(batchReports)
      .set({ status: 'pending_review', reviewNote: 'Please check section 3' })
      .where(eq(batchReports.id, report.id))
      .returning();

    expect(updated.status).toBe('pending_review');
    expect(updated.reviewNote).toBe('Please check section 3');
  });

  it('publishes with publishedAt timestamp — §4.2 human review gate', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [report] = await db
      .insert(batchReports)
      .values({ batchId: batch.id, status: 'pending_review' })
      .returning();

    const publishedAt = new Date();
    const [published] = await db
      .update(batchReports)
      .set({ status: 'published', publishedAt })
      .where(eq(batchReports.id, report.id))
      .returning();

    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
  });

  it('rejects null batchId', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();

    await expect(
      db.execute(
        `INSERT INTO batch_reports (batch_id) VALUES (NULL)` as never
      )
    ).rejects.toThrow();
  });

  it('stores reportFileUrl when provided', async () => {
    if (!process.env.TEST_DATABASE_URL) return;
    const db = getDb();
    const { batch } = await seedBatch();

    const [report] = await db
      .insert(batchReports)
      .values({
        batchId: batch.id,
        reportFileUrl: 'https://storage.example.com/reports/r-001.pdf',
      })
      .returning();

    expect(report.reportFileUrl).toBe('https://storage.example.com/reports/r-001.pdf');
  });
});
