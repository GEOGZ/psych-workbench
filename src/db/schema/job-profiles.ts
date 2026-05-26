import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const jobProfiles = pgTable('job_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  department: text('department'),
  competencies: jsonb('competencies').notNull().default([]),
  tools: jsonb('tools').notNull().default([]),
  notes: text('notes'),
  ownerUserId: uuid('owner_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type JobProfile = typeof jobProfiles.$inferSelect;
export type NewJobProfile = typeof jobProfiles.$inferInsert;
