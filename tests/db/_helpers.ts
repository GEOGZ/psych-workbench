import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

let container: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export async function setupTestDb(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:16').start();
  const connectionUri = container.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  pool = new Pool({ connectionString: connectionUri });
  db = drizzle(pool, { schema });
  await db.execute('CREATE EXTENSION IF NOT EXISTS btree_gist' as unknown as never);
  await migrate(db, { migrationsFolder: './src/db/migrations' });
}

export async function teardownTestDb(): Promise<void> {
  await pool?.end();
  await container?.stop();
  pool = undefined;
  container = undefined;
  db = undefined;
  delete process.env.DATABASE_URL;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) throw new Error('Test DB not initialized — call setupTestDb() first');
  return db;
}

export function getConnectionUri(): string {
  if (!container) throw new Error('Test DB not initialized — call setupTestDb() first');
  return container.getConnectionUri();
}
