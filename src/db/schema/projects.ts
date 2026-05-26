import { pgTable, pgEnum, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const projectState = pgEnum('project_state', [
  'lead',
  'qualifying',
  'discovery',
  'contract',
  'execution',
  'reporting',
  'closing',
  'done'
]);

export type ProjectState = (typeof projectState.enumValues)[number];

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),

  // FK to clients(id) — added in T4
  clientId: uuid('client_id').notNull(),

  // FK to users(id), the owning consultant — added in T3
  ownerUserId: uuid('owner_user_id').notNull(),

  title: text('title').notNull(),
  state: projectState('state').notNull().default('lead'),

  notes: text('notes'),

  stageMeta: jsonb('stage_meta').$type<Record<string, unknown>>().notNull().default({}),

  jobProfileId: uuid('job_profile_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
