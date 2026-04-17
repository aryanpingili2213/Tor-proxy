import { db } from "@workspace/db";
import { logsTable } from "@workspace/db/schema";
import { desc, sql } from "drizzle-orm";

export type LogLevel = "info" | "warn" | "error";

export async function addLog(
  message: string,
  level: LogLevel = "info",
  source: string = "system",
  metadata?: string
) {
  try {
    await db.insert(logsTable).values({ message, level, source, metadata: metadata ?? null });
  } catch {
    // swallow log insertion errors silently
  }
}

export async function getLogs(limit = 100, level = "all") {
  try {
    const query = db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.timestamp))
      .limit(limit);

    if (level !== "all") {
      const rows = await db
        .select()
        .from(logsTable)
        .where(sql`${logsTable.level} = ${level}`)
        .orderBy(desc(logsTable.timestamp))
        .limit(limit);
      return rows;
    }

    return await query;
  } catch {
    return [];
  }
}

export async function clearLogs() {
  await db.delete(logsTable);
}
