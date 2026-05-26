import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectReports = pgTable(
  'project_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    fileType: text('file_type').notNull().$type<'pdf' | 'word' | 'other'>(),
    fileKey: text('file_key').notNull(),
    fileUrl: text('file_url').notNull(),
    fileSize: integer('file_size'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    visibleToPortal: boolean('visible_to_portal').notNull().default(true),
  },
  (t) => ({
    projectIdx: index('project_reports_project_id_idx').on(t.projectId),
  })
);

export type ProjectReport = typeof projectReports.$inferSelect;
export type NewProjectReport = typeof projectReports.$inferInsert;
