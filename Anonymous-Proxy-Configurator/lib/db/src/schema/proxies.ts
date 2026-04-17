import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proxiesTable = pgTable("proxies", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("socks5"),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username"),
  password: text("password"),
  enabled: boolean("enabled").notNull().default(true),
  status: text("status").notNull().default("unknown"),
  latencyMs: integer("latency_ms"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProxySchema = createInsertSchema(proxiesTable).omit({ id: true, createdAt: true });
export type InsertProxy = z.infer<typeof insertProxySchema>;
export type Proxy = typeof proxiesTable.$inferSelect;
