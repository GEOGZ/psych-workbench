import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/*',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  },
  verbose: true,
  strict: true
} satisfies Config;
