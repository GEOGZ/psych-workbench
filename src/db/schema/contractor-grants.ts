import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * contractor_grants — explicit per-project access grants for contractor users.
 * A contractor user (role='contractor') sees nothing by default; access is
 * granted one project at a time, with a required expiresAt.
 *
 * Field-filtering at the router layer (PUBLIC_FIELDS vs FULL_FIELDS) enforces
 * spec §4.3 redline "不外包客户关系" — contractor never sees crisis contact,
 * full notes, or tokens.
 */
export const contractorGrants = pgTable(
  'contractor_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // FK to users(id), role='contractor' — added in T3
    userId: uuid('user_id').notNull(),

    // FK to projects(id) — added in T5/follow-up migration
    projectId: uuid('project_id').notNull(),

    // FK to users(id), the granting owner/admin — added in T3
    grantedByUserId: uuid('granted_by_user_id').notNull(),

    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true })
  },
  (t) => ({
    userProjectUnique: uniqueIndex('contractor_grants_user_project_unique').on(
      t.userId,
      t.projectId
    ),
    userIdx: index('contractor_grants_user_id_idx').on(t.userId),
    projectIdx: index('contractor_grants_project_id_idx').on(t.projectId)
  })
);

export type ContractorGrant = typeof contractorGrants.$inferSelect;
export type NewContractorGrant = typeof contractorGrants.$inferInsert;
