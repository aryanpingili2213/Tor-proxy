/**
 * rotation.ts — Automatic proxy rotation scheduler
 * Rotates the active proxy on a configurable interval.
 * Uses the DB to cycle through enabled alive proxies.
 */
import { db } from "@workspace/db";
import { proxiesTable } from "@workspace/db/schema";
import { eq, and, not } from "drizzle-orm";
import { addLog } from "./logger.js";
import { requestNewIdentity } from "./system.js";

export interface RotationState {
  active: boolean;
  intervalSeconds: number;
  nextRotationIn: number;
  rotationCount: number;
  currentProxyId: number | null;
  startedAt: Date | null;
}

/** In-memory rotation state (persisted to config in production) */
let rotationTimer: ReturnType<typeof setInterval> | null = null;
let rotationState: RotationState = {
  active: false,
  intervalSeconds: 180,
  nextRotationIn: 0,
  rotationCount: 0,
  currentProxyId: null,
  startedAt: null,
};
let nextRotationTimestamp = 0;

/** Perform one proxy rotation: picks the next alive enabled proxy */
async function rotate(): Promise<void> {
  try {
    const proxies = await db
      .select()
      .from(proxiesTable)
      .where(and(eq(proxiesTable.enabled, true), not(eq(proxiesTable.status, "dead"))));

    if (proxies.length === 0) {
      await addLog("Proxy rotation skipped — no alive proxies available", "warn", "rotation");
      return;
    }

    // Round-robin: pick the next proxy after the current one
    const currentIdx = proxies.findIndex((p) => p.id === rotationState.currentProxyId);
    const nextIdx = (currentIdx + 1) % proxies.length;
    const nextProxy = proxies[nextIdx];
    if (!nextProxy) return;

    rotationState.currentProxyId = nextProxy.id;
    rotationState.rotationCount += 1;
    nextRotationTimestamp = Date.now() + rotationState.intervalSeconds * 1000;

    await addLog(
      `Proxy rotated to ${nextProxy.type}://${nextProxy.host}:${nextProxy.port} (rotation #${rotationState.rotationCount})`,
      "info",
      "rotation"
    );

    // Also request a new Tor identity when rotating
    const nimResult = await requestNewIdentity();
    if (nimResult.success) {
      await addLog("New Tor identity requested alongside proxy rotation", "info", "rotation");
    }
  } catch (err) {
    const e = err as Error;
    await addLog(`Proxy rotation error: ${e.message}`, "error", "rotation");
  }
}

/** Start the proxy rotation scheduler */
export async function startRotation(intervalSeconds: number): Promise<RotationState> {
  if (rotationTimer) {
    clearInterval(rotationTimer);
  }

  rotationState.active = true;
  rotationState.intervalSeconds = intervalSeconds;
  rotationState.startedAt = new Date();
  nextRotationTimestamp = Date.now() + intervalSeconds * 1000;

  await addLog(`Proxy rotation started (every ${intervalSeconds}s)`, "info", "rotation");

  // Perform first rotation immediately
  await rotate();

  // Schedule subsequent rotations
  rotationTimer = setInterval(rotate, intervalSeconds * 1000);

  return { ...rotationState, nextRotationIn: intervalSeconds };
}

/** Stop the proxy rotation scheduler */
export async function stopRotation(): Promise<RotationState> {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  rotationState.active = false;
  rotationState.startedAt = null;
  await addLog("Proxy rotation stopped", "info", "rotation");
  return { ...rotationState, nextRotationIn: 0 };
}

/** Get current rotation status including seconds until next rotation */
export function getRotationStatus(): RotationState {
  const nextRotationIn = rotationState.active
    ? Math.max(0, Math.round((nextRotationTimestamp - Date.now()) / 1000))
    : 0;
  return { ...rotationState, nextRotationIn };
}
