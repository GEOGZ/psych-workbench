import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const sampleStatus = pgEnum('sample_status', [
  'pending',
  'in_progress',
  'completed',
  'reported'
]);

export type SampleStatus = (typeof sampleStatus.enumValues)[number];

// §5.3 red line: zero PII — only anonymous codes stored here.
// The B-client holds the code↔real-name mapping offline.
export const sampleIds = pgTable('sample_ids', {
  id: uuid('id').defaultRandom().primaryKey(),

  batchId: uuid('batch_id').notNull(),

  code: text('code').notNull().unique(),

  status: sampleStatus('status').notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export type SampleId = typeof sampleIds.$inferSelect;
export type NewSampleId = typeof sampleIds.$inferInsert;
