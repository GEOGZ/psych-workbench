import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const assessmentTools = pgTable('assessment_tools', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  source: text('source'),
  ownerUserId: uuid('owner_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AssessmentTool = typeof assessmentTools.$inferSelect;
export type NewAssessmentTool = typeof assessmentTools.$inferInsert;
