import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { clients } from '@/db/schema/clients';

beforeAll(setupTestDb, 60_000);
afterAll(teardownTestDb);

describe('clients crisis contact constraint', () => {
  it('rejects insert when crisis contact is null', async () => {
    const db = getDb();
    await expect(
      db.execute(
        sql`INSERT INTO clients (name, contact_name, crisis_contact_name, crisis_contact_phone) VALUES ('Acme', 'Bob', NULL, NULL)`
      )
    ).rejects.toThrow(/null value.*crisis_contact/i);
  });

  it('accepts when crisis contact filled', async () => {
    const db = getDb();
    const result = await db
      .insert(clients)
      .values({
        name: 'Acme Corp',
        contactName: 'Alice',
        crisisContactName: 'Emergency Contact',
        crisisContactPhone: '555-1234'
      })
      .returning();
    expect(result[0]?.id).toBeTruthy();
  });
});
