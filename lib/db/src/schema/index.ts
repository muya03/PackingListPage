import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const packingSessionsTable = pgTable("packing_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  meta: jsonb("meta").notNull(),
  rows: jsonb("rows").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type PackingSession = typeof packingSessionsTable.$inferSelect;

export interface InsertPackingSession {
  name: string;
  meta: unknown;
  rows: unknown;
}
