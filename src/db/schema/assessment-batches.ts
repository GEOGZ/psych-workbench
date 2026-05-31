import { pgTable, pgEnum, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const batchStatus = pgEnum('batch_status', ['draft', 'active', 'completed']);

export type BatchStatus = (typeof batchStatus.enumValues)[number];

export const assessmentBatches = pgTable('assessment_batches', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: text('name').notNull(),
  projectId: uuid('project_id').notNull(),

  assessmentTool: text('assessment_tool'),
  estimatedCount: integer('estimated_count'),

  projectContactName: text('project_contact_name').notNull(),
  projectContactPhone: text('project_contact_phone').notNull(),
  projectContactEmail: text('project_contact_email'),

  crisisContactName: text('crisis_contact_name').notNull(),
  crisisContactPhone: text('crisis_contact_phone').notNull(),

  status: batchStatus('status').notNull().default('draft'),

  deadline: timestamp('deadline', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export type AssessmentBatch = typeof assessmentBatches.$inferSelect;
export type NewAssessmentBatch = typeof assessmentBatches.$inferInsert;
