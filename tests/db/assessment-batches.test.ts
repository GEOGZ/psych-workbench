import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { assessmentBatches } from '@/db/schema/assessment-batches';
import { projects } from '@/db/schema/projects';
import { clients } from '@/db/schema/clients';
import { users } from '@/db/schema/users';

beforeAll(setupTestDb, 60_000);
afterAll(teardownTestDb);

async function seedProject() {
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
  return project!.id;
}

describe('assessment_batches schema constraints', () => {
  it('rejects insert when project_contact_name is null', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO assessment_batches
          (name, project_id, project_contact_name, project_contact_phone, project_contact_email,
           crisis_contact_name, crisis_contact_phone)
          VALUES ('Batch A', gen_random_uuid(), NULL, '555', 'a@b.com', 'EC', '555')`
      )
    ).rejects.toThrow(/null value.*project_contact_name/i);
  });

  it('rejects insert when crisis_contact_name is null', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO assessment_batches
          (name, project_id, project_contact_name, project_contact_phone, project_contact_email,
           crisis_contact_name, crisis_contact_phone)
          VALUES ('Batch B', gen_random_uuid(), 'PM', '555', 'a@b.com', NULL, '555')`
      )
    ).rejects.toThrow(/null value.*crisis_contact_name/i);
  });

  it('rejects insert when crisis_contact_phone is null', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO assessment_batches
          (name, project_id, project_contact_name, project_contact_phone, project_contact_email,
           crisis_contact_name, crisis_contact_phone)
          VALUES ('Batch C', gen_random_uuid(), 'PM', '555', 'a@b.com', 'EC', NULL)`
      )
    ).rejects.toThrow(/null value.*crisis_contact_phone/i);
  });

  it('accepts valid batch with all required contact fields', async () => {
    const db = getDb();
    const projectId = await seedProject();
    const [batch] = await db
      .insert(assessmentBatches)
      .values({
        name: 'Q2-2026 领导力测评',
        projectId,
        assessmentTool: 'MBTI',
        estimatedCount: 50,
        projectContactName: 'Alice PM',
        projectContactPhone: '138-0000-0001',
        projectContactEmail: 'alice@corp.com',
        crisisContactName: '危机联系人',
        crisisContactPhone: '139-9999-9999',
        status: 'draft'
      })
      .returning();
    expect(batch?.id).toBeTruthy();
    expect(batch?.status).toBe('draft');
  });

  it('defaults status to draft', async () => {
    const db = getDb();
    const projectId = await seedProject();
    const [batch] = await db
      .insert(assessmentBatches)
      .values({
        name: 'Status Default Test',
        projectId,
        projectContactName: 'PM',
        projectContactPhone: '555',
        crisisContactName: 'EC',
        crisisContactPhone: '555'
      })
      .returning();
    expect(batch?.status).toBe('draft');
  });

  it('rejects invalid status value', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO assessment_batches
          (name, project_id, project_contact_name, project_contact_phone,
           crisis_contact_name, crisis_contact_phone, status)
          VALUES ('Bad Status', gen_random_uuid(), 'PM', '555', 'EC', '555', 'invalid_status')`
      )
    ).rejects.toThrow(/invalid input value for enum/i);
  });
});
