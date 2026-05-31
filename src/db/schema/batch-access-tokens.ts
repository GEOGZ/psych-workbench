import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const batchAccessTokens = pgTable('batch_access_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  token: text('token').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BatchAccessToken = typeof batchAccessTokens.$inferSelect;
export type NewBatchAccessToken = typeof batchAccessTokens.$inferInsert;
