import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

let pool: Pool | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

// When TEST_DATABASE_URL is set, tests run against a real DB.
// When absent, setupTestDb throws a skip signal so test suites are
// skipped rather than erroring (no Docker / no local pg on this machine).
const TEST_DB_URL = process.env.TEST_DATABASE_URL;

export async function setupTestDb(): Promise<void> {
  if (!TEST_DB_URL) {
    throw new Error('SKIP: TEST_DATABASE_URL not set — no database available');
  }
  pool = new Pool({ connectionString: TEST_DB_URL });
  db = drizzle(pool, { schema });
  await db.execute('CREATE EXTENSION IF NOT EXISTS btree_gist' as unknown as never);
  await migrate(db, { migrationsFolder: './src/db/migrations' });
}

export async function teardownTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) throw new Error('Test DB not initialized — call setupTestDb() first');
  return db;
}

export function getConnectionUri(): string {
  if (!TEST_DB_URL) throw new Error('TEST_DATABASE_URL not set');
  return TEST_DB_URL;
}
