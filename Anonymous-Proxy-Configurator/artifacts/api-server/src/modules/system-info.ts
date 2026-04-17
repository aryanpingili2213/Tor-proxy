/**
 * system-info.ts — Linux system information module
 * Detects the Linux distribution, kernel, CPU usage, and RAM usage.
 * Uses /proc/stat, /proc/meminfo, and /etc/os-release for system data.
 */
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";

const execAsync = promisify(exec);

/** Run a shell command and return stdout, returning empty string on error */
async function safeExec(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export interface SystemInfoResult {
  distro: string;
  distroVersion?: string;
  kernel?: string;
  cpuUsagePercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  ramUsagePercent: number;
  uptime?: string;
  hostname?: string;
}

/** Detect the Linux distribution from /etc/os-release */
async function getDistroInfo(): Promise<{ distro: string; version?: string }> {
  try {
    const raw = await readFile("/etc/os-release", "utf-8");
    const name = raw.match(/^PRETTY_NAME="(.+)"/m)?.[1]
      ?? raw.match(/^NAME="(.+)"/m)?.[1]
      ?? "Linux";
    const version = raw.match(/^VERSION="(.+)"/m)?.[1]
      ?? raw.match(/^VERSION_ID="(.+)"/m)?.[1];
    // Detect specific distros for friendly display
    const lower = name.toLowerCase();
    if (lower.includes("kali")) return { distro: "Kali Linux", version };
    if (lower.includes("ubuntu")) return { distro: "Ubuntu", version };
    if (lower.includes("debian")) return { distro: "Debian", version };
    if (lower.includes("fedora")) return { distro: "Fedora", version };
    if (lower.includes("centos")) return { distro: "CentOS", version };
    if (lower.includes("arch")) return { distro: "Arch Linux", version };
    if (lower.includes("parrot")) return { distro: "Parrot OS", version };
    if (lower.includes("nixos")) return { distro: "NixOS", version };
    return { distro: name, version };
  } catch {
    return { distro: "Linux" };
  }
}

/** 
 * Get CPU usage by reading /proc/stat twice (100ms apart) and computing delta.
 * Returns usage as a percentage (0–100).
 */
async function getCpuUsage(): Promise<number> {
  async function readStat(): Promise<number[]> {
    try {
      const raw = await readFile("/proc/stat", "utf-8");
      const line = raw.split("\n")[0] ?? "";
      // cpu  user nice system idle iowait irq softirq steal guest guestnice
      return line.split(/\s+/).slice(1).map(Number);
    } catch {
      return [];
    }
  }

  const s1 = await readStat();
  await new Promise((r) => setTimeout(r, 200));
  const s2 = await readStat();

  if (s1.length < 4 || s2.length < 4) {
    // Fallback: use top/vmstat
    const top = await safeExec("top -bn1 | grep '%Cpu' | awk '{print $2}' | cut -d'.' -f1");
    return parseFloat(top) || 0;
  }

  const idle1 = s1[3] ?? 0, idle2 = s2[3] ?? 0;
  const total1 = s1.reduce((a, b) => a + b, 0);
  const total2 = s2.reduce((a, b) => a + b, 0);
  const totalDelta = total2 - total1;
  const idleDelta = idle2 - idle1;
  if (totalDelta === 0) return 0;
  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 10) / 10;
}

/** Get RAM info from /proc/meminfo, returns used/total in MB */
async function getRamInfo(): Promise<{ usedMb: number; totalMb: number }> {
  try {
    const raw = await readFile("/proc/meminfo", "utf-8");
    const getKb = (key: string): number => {
      const match = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return match ? parseInt(match[1] ?? "0") : 0;
    };
    const total = getKb("MemTotal");
    const free = getKb("MemFree");
    const buffers = getKb("Buffers");
    const cached = getKb("Cached");
    const sReclaimable = getKb("SReclaimable");
    const used = total - free - buffers - cached - sReclaimable;
    return {
      totalMb: Math.round(total / 1024),
      usedMb: Math.round(Math.max(0, used) / 1024),
    };
  } catch {
    // Fallback via free command
    try {
      const out = await safeExec("free -m | awk 'NR==2{print $2,$3}'");
      const parts = out.split(" ");
      return { totalMb: parseInt(parts[0] ?? "0"), usedMb: parseInt(parts[1] ?? "0") };
    } catch {
      return { totalMb: 0, usedMb: 0 };
    }
  }
}

/** Get system uptime in human-readable format */
async function getUptime(): Promise<string> {
  const out = await safeExec("uptime -p 2>/dev/null || cat /proc/uptime");
  if (out.startsWith("up ")) return out;
  const seconds = parseFloat(out.split(" ")[0] ?? "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `up ${h}h ${m}m`;
}

/** Main export: gather all system info */
export async function getSystemInfo(): Promise<SystemInfoResult> {
  const [distroInfo, cpuUsage, ram, uptime, kernel, hostname] = await Promise.all([
    getDistroInfo(),
    getCpuUsage(),
    getRamInfo(),
    getUptime(),
    safeExec("uname -r"),
    safeExec("hostname"),
  ]);

  const ramPercent = ram.totalMb > 0
    ? Math.round((ram.usedMb / ram.totalMb) * 100 * 10) / 10
    : 0;

  return {
    distro: distroInfo.distro,
    distroVersion: distroInfo.version,
    kernel: kernel || undefined,
    cpuUsagePercent: cpuUsage,
    ramUsedMb: ram.usedMb,
    ramTotalMb: ram.totalMb,
    ramUsagePercent: ramPercent,
    uptime: uptime || undefined,
    hostname: hostname || undefined,
  };
}
