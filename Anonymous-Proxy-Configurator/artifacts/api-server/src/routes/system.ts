/**
 * system.ts — System management routes
 * Handles Tor/Proxychains install, start/stop, new identity,
 * backup/restore, proxy rotation, system info, and config.
 */
import { Router, type IRouter } from "express";
import {
  checkTorInstalled,
  checkTorRunning,
  checkProxychainsInstalled,
  installTor,
  startTor,
  stopTor,
  requestNewIdentity,
  installProxychains,
  configureProxychains,
  backupProxychains,
  restoreProxychains,
} from "../modules/system.js";
import { getSystemInfo } from "../modules/system-info.js";
import { getConfig, saveConfig } from "../modules/config.js";
import { startRotation, stopRotation, getRotationStatus } from "../modules/rotation.js";
import { db } from "@workspace/db";
import { proxiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/** GET /system/status — overall system health */
router.get("/status", async (req, res) => {
  try {
    const [torCheck, torRunning, proxychainsCheck, proxies] = await Promise.all([
      checkTorInstalled(),
      checkTorRunning(),
      checkProxychainsInstalled(),
      db.select().from(proxiesTable),
    ]);
    const activeProxies = proxies.filter((p) => p.status === "alive" && p.enabled);
    res.json({
      torInstalled: torCheck.installed,
      torRunning,
      proxychainsInstalled: proxychainsCheck.installed,
      proxychainsConfigured: proxychainsCheck.installed,
      proxyCount: proxies.length,
      activeProxyCount: activeProxies.length,
      torVersion: torCheck.version,
      proxychainsVersion: proxychainsCheck.version,
      lastChecked: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting system status");
    res.status(500).json({ error: "Failed to get system status" });
  }
});

/** GET /system/info — Linux distro, CPU, RAM usage */
router.get("/info", async (req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (err) {
    req.log.error({ err }, "Error getting system info");
    res.status(500).json({ error: "Failed to get system info" });
  }
});

/** GET /system/config — read current config.json */
router.get("/config", async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Error reading config");
    res.status(500).json({ error: "Failed to read config" });
  }
});

/** PUT /system/config — update config.json */
router.put("/config", async (req, res) => {
  try {
    const updated = await saveConfig(req.body as Record<string, unknown>);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating config");
    res.status(500).json({ error: "Failed to update config" });
  }
});

/** POST /system/tor/install */
router.post("/tor/install", async (req, res) => {
  try {
    res.json(await installTor());
  } catch (err) {
    req.log.error({ err }, "Error installing Tor");
    res.status(500).json({ error: "Failed to install Tor" });
  }
});

/** POST /system/tor/start */
router.post("/tor/start", async (req, res) => {
  try {
    res.json(await startTor());
  } catch (err) {
    req.log.error({ err }, "Error starting Tor");
    res.status(500).json({ error: "Failed to start Tor" });
  }
});

/** POST /system/tor/stop */
router.post("/tor/stop", async (req, res) => {
  try {
    res.json(await stopTor());
  } catch (err) {
    req.log.error({ err }, "Error stopping Tor");
    res.status(500).json({ error: "Failed to stop Tor" });
  }
});

/** POST /system/tor/newnym — request a new Tor identity */
router.post("/tor/newnym", async (req, res) => {
  try {
    res.json(await requestNewIdentity());
  } catch (err) {
    req.log.error({ err }, "Error requesting new identity");
    res.status(500).json({ error: "Failed to request new identity" });
  }
});

/** POST /system/proxychains/install */
router.post("/proxychains/install", async (req, res) => {
  try {
    res.json(await installProxychains());
  } catch (err) {
    req.log.error({ err }, "Error installing Proxychains");
    res.status(500).json({ error: "Failed to install Proxychains" });
  }
});

/** POST /system/proxychains/configure */
router.post("/proxychains/configure", async (req, res) => {
  try {
    const proxies = await db.select().from(proxiesTable).where(eq(proxiesTable.enabled, true));
    res.json(
      await configureProxychains(
        proxies.map((p) => ({ type: p.type, host: p.host, port: p.port, username: p.username, password: p.password }))
      )
    );
  } catch (err) {
    req.log.error({ err }, "Error configuring Proxychains");
    res.status(500).json({ error: "Failed to configure Proxychains" });
  }
});

/** POST /system/proxychains/backup */
router.post("/proxychains/backup", async (req, res) => {
  try {
    res.json(await backupProxychains());
  } catch (err) {
    req.log.error({ err }, "Error backing up Proxychains config");
    res.status(500).json({ error: "Failed to backup Proxychains config" });
  }
});

/** POST /system/proxychains/restore */
router.post("/proxychains/restore", async (req, res) => {
  try {
    res.json(await restoreProxychains());
  } catch (err) {
    req.log.error({ err }, "Error restoring Proxychains config");
    res.status(500).json({ error: "Failed to restore Proxychains config" });
  }
});

/** POST /system/rotation/start — start proxy rotation */
router.post("/rotation/start", async (req, res) => {
  try {
    const body = req.body as { intervalSeconds?: number };
    const config = await getConfig();
    const interval = body.intervalSeconds ?? config.rotationIntervalSeconds;
    const state = await startRotation(Math.max(30, interval));
    res.json({ success: true, message: `Proxy rotation started (every ${interval}s)`, status: "active", ...state });
  } catch (err) {
    req.log.error({ err }, "Error starting rotation");
    res.status(500).json({ error: "Failed to start rotation" });
  }
});

/** POST /system/rotation/stop — stop proxy rotation */
router.post("/rotation/stop", async (req, res) => {
  try {
    const state = await stopRotation();
    res.json({ success: true, message: "Proxy rotation stopped", status: "stopped", ...state });
  } catch (err) {
    req.log.error({ err }, "Error stopping rotation");
    res.status(500).json({ error: "Failed to stop rotation" });
  }
});

/** GET /system/rotation/status — get rotation state */
router.get("/rotation/status", async (_req, res) => {
  try {
    res.json(getRotationStatus());
  } catch (err) {
    res.status(500).json({ error: "Failed to get rotation status" });
  }
});

export default router;
