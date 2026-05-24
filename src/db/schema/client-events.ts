import { pgTable, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projectEventType } from './project-events';

export const clientEvents = pgTable('client_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull(),
  actorUserId: uuid('actor_user_id'),
  eventType: projectEventType('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  clientAtIdx: index('client_events_client_id_at_idx').on(t.clientId, t.at)
}));

export type ClientEvent = typeof clientEvents.$inferSelect;
export type NewClientEvent = typeof clientEvents.$inferInsert;
