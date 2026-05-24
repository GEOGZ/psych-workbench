import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const ownerEmail = process.env.OWNER_EMAIL;
if (!ownerEmail) {
  console.error('OWNER_EMAIL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function seedOwner(): Promise<void> {
  try {
    const result = await pool.query(
      `INSERT INTO users (email, role, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (email) DO UPDATE
       SET role = $2, updated_at = now()
       RETURNING id`,
      [ownerEmail, 'owner']
    );

    const userId = result.rows[0]?.id;
    if (!userId) {
      throw new Error('Failed to seed owner user');
    }

    console.log(`owner seeded: ${userId}`);
  } catch (error) {
    console.error('Error seeding owner:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedOwner();
