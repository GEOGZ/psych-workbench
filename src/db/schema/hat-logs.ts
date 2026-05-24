import { pgTable, pgEnum, uuid, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const hatType = pgEnum('hat_type', ['🎩', '🧠', '🛠', '📊']);
export const hatSource = pgEnum('hat_source', ['manual', 'backfill']);

export type HatType = (typeof hatType.enumValues)[number];
export type HatSource = (typeof hatSource.enumValues)[number];

export const hatLogs = pgTable('hat_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  hat: hatType('hat').notNull(),
  projectId: uuid('project_id'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  source: hatSource('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id] }).onDelete('cascade'),
  projectFk: foreignKey({ columns: [table.projectId], foreignColumns: [projects.id] }).onDelete('set null'),
}));

export type HatLog = typeof hatLogs.$inferSelect;
export type NewHatLog = typeof hatLogs.$inferInsert;
