import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  index
} from 'drizzle-orm/pg-core';

export const projectEventType = pgEnum('project_event_type', [
  'state_advanced',
  'note_added',
  'hat_switched',
  'contractor_granted',
  'contractor_revoked',
  'portal_token_issued',
  'portal_token_revoked',
  'checklist_toggled',
  'stage_meta_updated',
  'project_updated',
  'client_updated',
  'monthly_retrospective'
]);

export type ProjectEventType = (typeof projectEventType.enumValues)[number];

export const projectEvents = pgTable(
  'project_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // FK to projects(id) — added in T5/follow-up migration
    projectId: uuid('project_id').notNull(),

    // FK to users(id), the actor who caused the event — added in T3
    actorUserId: uuid('actor_user_id'),

    eventType: projectEventType('event_type').notNull(),

    payload: jsonb('payload').notNull().default({}),

    at: timestamp('at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    projectAtIdx: index('project_events_project_id_at_idx').on(t.projectId, t.at)
  })
);

export type ProjectEvent = typeof projectEvents.$inferSelect;
export type NewProjectEvent = typeof projectEvents.$inferInsert;
