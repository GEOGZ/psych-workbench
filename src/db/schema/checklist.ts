import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const projectChecklistItems = pgTable('project_checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  stage: text('stage').notNull(),
  key: text('key').notNull(),
  checked: boolean('checked').notNull().default(false),
  checkedAt: timestamp('checked_at', { withTimezone: true }),
  checkedByUserId: uuid('checked_by_user_id'),
});

export type ProjectChecklistItem = typeof projectChecklistItems.$inferSelect;
export type NewProjectChecklistItem = typeof projectChecklistItems.$inferInsert;
