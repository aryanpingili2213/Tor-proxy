import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const logsTable = pgTable("logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  source: text("source").notNull().default("system"),
  metadata: text("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertLogSchema = createInsertSchema(logsTable).omit({ id: true, timestamp: true });
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logsTable.$inferSelect;
