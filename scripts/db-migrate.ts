import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), 'src', 'db', 'migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: url });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await pool.query<{ name: string }>(
        'SELECT name FROM _migrations WHERE name = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`[skip] ${file} already applied`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[apply] ${file}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    console.log('Migrations complete.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
