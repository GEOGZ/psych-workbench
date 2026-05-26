import {
  pgTable,
  uuid,
  text,
  timestamp,
  index
} from 'drizzle-orm/pg-core';
import { projectReports } from './project-reports';
import { users } from './users';
import { clientPortalTokens } from './client-portal-tokens';

export const reportAccessLogs = pgTable(
  'report_access_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id').notNull().references(() => projectReports.id, { onDelete: 'cascade' }),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
    actorType: text('actor_type').notNull().$type<'user' | 'portal'>(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    portalTokenId: uuid('portal_token_id').references(() => clientPortalTokens.id, { onDelete: 'set null' }),
    action: text('action').notNull().$type<'view' | 'download'>(),
    ipAddress: text('ip_address'),
  },
  (t) => ({
    reportIdx: index('report_access_logs_report_id_idx').on(t.reportId),
  })
);

export type ReportAccessLog = typeof reportAccessLogs.$inferSelect;
export type NewReportAccessLog = typeof reportAccessLogs.$inferInsert;
