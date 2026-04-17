/**
 * proxies.ts — Proxy management routes
 * Supports add, delete, validate, bulk upload, remove dead, and proxy rating.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { proxiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { validateProxy } from "../modules/proxy-validator.js";
import { addLog } from "../modules/logger.js";

const router: IRouter = Router();

/** Compute a proxy rating based on latency */
function computeRating(latencyMs: number | null | undefined): "fast" | "medium" | "slow" | "unknown" {
  if (!latencyMs) return "unknown";
  if (latencyMs < 200) return "fast";
  if (latencyMs < 500) return "medium";
  return "slow";
}

/** Validate and parse a proxy creation payload */
function parseProxyBody(
  body: unknown
): { type: string; host: string; port: number; username?: string; password?: string; enabled: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!b.host || typeof b.host !== "string") return null;
  if (!b.port || typeof b.port !== "number") return null;
  const validTypes = ["socks5", "socks4", "http", "https"];
  const type = typeof b.type === "string" && validTypes.includes(b.type) ? b.type : "socks5";
  return {
    type,
    host: b.host,
    port: b.port,
    username: typeof b.username === "string" && b.username ? b.username : undefined,
    password: typeof b.password === "string" && b.password ? b.password : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : true,
  };
}

/** Format a proxy DB row for API response */
function formatProxy(p: typeof proxiesTable.$inferSelect) {
  return {
    ...p,
    rating: computeRating(p.latencyMs),
    lastChecked: p.lastChecked ? p.lastChecked.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** GET /proxies — list all proxies */
router.get("/", async (req, res) => {
  try {
    const proxies = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);
    res.json(proxies.map(formatProxy));
  } catch (err) {
    req.log.error({ err }, "Error listing proxies");
    res.status(500).json({ error: "Failed to list proxies" });
  }
});

/** POST /proxies — add a single proxy */
router.post("/", async (req, res) => {
  try {
    const data = parseProxyBody(req.body);
    if (!data) return res.status(400).json({ error: "Invalid proxy data", details: "host and port are required" });

    const [proxy] = await db
      .insert(proxiesTable)
      .values({ type: data.type, host: data.host, port: data.port, username: data.username ?? null, password: data.password ?? null, enabled: data.enabled, status: "unknown" })
      .returning();

    await addLog(`Proxy added: ${data.type}://${data.host}:${data.port}`, "info", "proxy-manager");
    return res.status(201).json(formatProxy(proxy));
  } catch (err) {
    req.log.error({ err }, "Error adding proxy");
    return res.status(500).json({ error: "Failed to add proxy" });
  }
});

/**
 * POST /proxies/bulk-upload — bulk import proxies from plain text
 * Supported formats (one per line):
 *   - host:port
 *   - type:host:port  (e.g. socks5:1.2.3.4:1080)
 *   - type://host:port (e.g. socks5://1.2.3.4:1080)
 *   - host:port:username:password
 */
router.post("/bulk-upload", async (req, res) => {
  try {
    const body = req.body as { text?: string; defaultType?: string };
    if (!body.text || typeof body.text !== "string") {
      return res.status(400).json({ error: "text field is required" });
    }
    const defaultType = ["socks5", "socks4", "http", "https"].includes(body.defaultType ?? "")
      ? (body.defaultType as string)
      : "socks5";

    const lines = body.text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    let added = 0, skipped = 0, errors = 0;

    for (const line of lines) {
      try {
        let type = defaultType, host = "", port = 0, username: string | undefined, password: string | undefined;

        // Strip scheme: socks5://host:port
        const schemeMatch = line.match(/^(socks5|socks4|http|https):\/\/(.+):(\d+)$/i);
        if (schemeMatch) {
          type = schemeMatch[1]!.toLowerCase();
          host = schemeMatch[2]!;
          port = parseInt(schemeMatch[3]!);
        } else {
          const parts = line.split(":");
          if (parts.length === 2) {
            // host:port
            host = parts[0]!;
            port = parseInt(parts[1]!);
          } else if (parts.length === 3) {
            const validTypes = ["socks5", "socks4", "http", "https"];
            if (validTypes.includes(parts[0]!.toLowerCase())) {
              // type:host:port
              type = parts[0]!.toLowerCase();
              host = parts[1]!;
              port = parseInt(parts[2]!);
            } else {
              // host:port:user (unusual)
              host = parts[0]!;
              port = parseInt(parts[1]!);
              username = parts[2];
            }
          } else if (parts.length >= 4) {
            const validTypes = ["socks5", "socks4", "http", "https"];
            if (validTypes.includes(parts[0]!.toLowerCase())) {
              // type:host:port:user:pass
              type = parts[0]!.toLowerCase();
              host = parts[1]!;
              port = parseInt(parts[2]!);
              username = parts[3];
              password = parts[4];
            } else {
              // host:port:user:pass
              host = parts[0]!;
              port = parseInt(parts[1]!);
              username = parts[2];
              password = parts[3];
            }
          }
        }

        if (!host || isNaN(port) || port < 1 || port > 65535) {
          errors++;
          continue;
        }

        // Check if duplicate
        const existing = await db
          .select()
          .from(proxiesTable)
          .where(eq(proxiesTable.host, host));
        const dup = existing.find((p) => p.port === port);
        if (dup) {
          skipped++;
          continue;
        }

        await db.insert(proxiesTable).values({
          type,
          host,
          port,
          username: username ?? null,
          password: password ?? null,
          enabled: true,
          status: "unknown",
        });
        added++;
      } catch {
        errors++;
      }
    }

    await addLog(`Bulk upload: ${added} added, ${skipped} skipped, ${errors} errors`, "info", "proxy-manager");
    return res.json({
      added,
      skipped,
      errors,
      total: lines.length,
      message: `Imported ${added} proxies (${skipped} duplicates skipped, ${errors} errors)`,
    });
  } catch (err) {
    req.log.error({ err }, "Error in bulk upload");
    return res.status(500).json({ error: "Failed to process bulk upload" });
  }
});

/** POST /proxies/remove-dead — delete all proxies with status "dead" */
router.post("/remove-dead", async (req, res) => {
  try {
    const dead = await db.select().from(proxiesTable).where(eq(proxiesTable.status, "dead"));
    for (const p of dead) {
      await db.delete(proxiesTable).where(eq(proxiesTable.id, p.id));
    }
    await addLog(`Removed ${dead.length} dead proxies`, "info", "proxy-manager");
    return res.json({ success: true, message: `Removed ${dead.length} dead ${dead.length === 1 ? "proxy" : "proxies"}` });
  } catch (err) {
    req.log.error({ err }, "Error removing dead proxies");
    return res.status(500).json({ success: false, message: "Failed to remove dead proxies" });
  }
});

/** DELETE /proxies/:id — delete a specific proxy */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid proxy ID" });
    const existing = await db.select().from(proxiesTable).where(eq(proxiesTable.id, id));
    if (existing.length === 0) return res.status(404).json({ error: "Proxy not found" });
    await db.delete(proxiesTable).where(eq(proxiesTable.id, id));
    await addLog(`Proxy deleted: ID ${id}`, "info", "proxy-manager");
    return res.json({ success: true, message: "Proxy deleted" });
  } catch (err) {
    req.log.error({ err }, "Error deleting proxy");
    return res.status(500).json({ error: "Failed to delete proxy" });
  }
});

/** POST /proxies/:id/validate — check if a specific proxy is alive */
router.post("/:id/validate", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid proxy ID" });
    const [proxy] = await db.select().from(proxiesTable).where(eq(proxiesTable.id, id));
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });

    await db.update(proxiesTable).set({ status: "checking" }).where(eq(proxiesTable.id, id));
    const result = await validateProxy(id, proxy.host, proxy.port);
    const rating = computeRating(result.latencyMs);

    await db
      .update(proxiesTable)
      .set({ status: result.alive ? "alive" : "dead", latencyMs: result.latencyMs ?? null, lastChecked: new Date() })
      .where(eq(proxiesTable.id, id));

    return res.json({ ...result, rating });
  } catch (err) {
    req.log.error({ err }, "Error validating proxy");
    return res.status(500).json({ error: "Failed to validate proxy" });
  }
});

/** POST /proxies/validate-all — validate every proxy in parallel */
router.post("/validate-all", async (req, res) => {
  try {
    const proxies = await db.select().from(proxiesTable);
    for (const p of proxies) {
      await db.update(proxiesTable).set({ status: "checking" }).where(eq(proxiesTable.id, p.id));
    }

    const results = await Promise.all(proxies.map((p) => validateProxy(p.id, p.host, p.port)));

    for (const r of results) {
      await db
        .update(proxiesTable)
        .set({ status: r.alive ? "alive" : "dead", latencyMs: r.latencyMs ?? null, lastChecked: new Date() })
        .where(eq(proxiesTable.id, r.proxyId));
    }

    return res.json(results.map((r) => ({ ...r, rating: computeRating(r.latencyMs) })));
  } catch (err) {
    req.log.error({ err }, "Error validating all proxies");
    return res.status(500).json({ error: "Failed to validate proxies" });
  }
});

export default router;
