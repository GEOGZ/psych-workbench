import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * client_portal_tokens — read-only magic-link tokens for the client portal (T17).
 * Independent from NextAuth; validated by /api/portal/* middleware.
 *
 * Security:
 * - token is 64-char hex (32 bytes from crypto.randomBytes), unique
 * - revokedAt cuts off all future use without deleting the audit row
 * - expiresAt is required (no perpetual tokens)
 */
export const clientPortalTokens = pgTable(
  'client_portal_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // FK to clients(id) — added in T4
    clientId: uuid('client_id').notNull(),

    // FK to users(id), the owning consultant who issued it — added in T3
    issuedByUserId: uuid('issued_by_user_id').notNull(),

    token: text('token').notNull(),

    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
  },
  (t) => ({
    tokenUnique: uniqueIndex('client_portal_tokens_token_unique').on(t.token),
    clientIdx: index('client_portal_tokens_client_id_idx').on(t.clientId)
  })
);

export type ClientPortalToken = typeof clientPortalTokens.$inferSelect;
export type NewClientPortalToken = typeof clientPortalTokens.$inferInsert;
