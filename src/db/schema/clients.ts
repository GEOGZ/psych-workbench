import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  crisisContactName: text('crisis_contact_name').notNull(),
  crisisContactPhone: text('crisis_contact_phone').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
