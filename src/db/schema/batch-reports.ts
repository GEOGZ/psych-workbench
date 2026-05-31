import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const reportStatus = pgEnum('report_status', ['draft', 'pending_review', 'published']);
export type ReportStatus = (typeof reportStatus.enumValues)[number];

// §4.2: Reports require human review before publish (draft → pending_review → published).
export const batchReports = pgTable('batch_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull(),
  status: reportStatus('status').notNull().default('draft'),
  reportFileUrl: text('report_file_url'),
  reviewNote: text('review_note'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BatchReport = typeof batchReports.$inferSelect;
export type NewBatchReport = typeof batchReports.$inferInsert;
