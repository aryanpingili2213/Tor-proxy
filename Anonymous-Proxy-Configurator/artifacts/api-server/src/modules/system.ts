/**
 * system.ts — Core Tor and Proxychains management module
 * Handles installation, service control, configuration, and backup.
 */
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { addLog } from "./logger.js";

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

/** Run a shell command, capturing stdout/stderr, never throwing */
async function runCommand(cmd: string): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      stdout: e.stdout?.trim() ?? "",
      stderr: e.stderr?.trim() ?? e.message ?? "Unknown error",
    };
  }
}

/** Check if Tor is installed and return its version if available */
export async function checkTorInstalled(): Promise<{ installed: boolean; version?: string }> {
  const result = await runCommand("tor --version 2>&1");
  if (result.success || result.stdout.includes("Tor version")) {
    const match = result.stdout.match(/Tor version ([\d.]+)/);
    return { installed: true, version: match?.[1] };
  }
  const which = await runCommand("which tor");
  return { installed: which.success, version: undefined };
}

/** Check if the Tor process is currently running */
export async function checkTorRunning(): Promise<boolean> {
  const result = await runCommand("pgrep -x tor");
  if (result.success) return true;
  const ps = await runCommand("ps aux | grep -v grep | grep ' tor '");
  return ps.success && ps.stdout.length > 0;
}

/** Install Tor via the system package manager if not already installed */
export async function installTor(): Promise<{ success: boolean; message: string; alreadyInstalled: boolean; version?: string }> {
  const check = await checkTorInstalled();
  if (check.installed) {
    return { success: true, message: "Tor is already installed", alreadyInstalled: true, version: check.version };
  }

  await addLog("Attempting to install Tor...", "info", "install");

  const apt = await runCommand("which apt-get");
  if (apt.success) {
    const update = await runCommand("apt-get update -qq 2>&1");
    if (!update.success) await addLog(`apt-get update failed: ${update.stderr}`, "warn", "install");
    const install = await runCommand("apt-get install -y tor 2>&1");
    if (install.success) {
      const afterCheck = await checkTorInstalled();
      await addLog("Tor installed via apt-get", "info", "install");
      return { success: true, message: "Tor installed via apt-get", alreadyInstalled: false, version: afterCheck.version };
    }
  }

  const yum = await runCommand("which yum");
  if (yum.success) {
    const install = await runCommand("yum install -y tor 2>&1");
    if (install.success) {
      const afterCheck = await checkTorInstalled();
      await addLog("Tor installed via yum", "info", "install");
      return { success: true, message: "Tor installed via yum", alreadyInstalled: false, version: afterCheck.version };
    }
  }

  await addLog("Tor installation not available in sandboxed environment", "warn", "install");
  return {
    success: false,
    message: "Tor installation requires root privileges. Run: sudo apt-get install tor",
    alreadyInstalled: false,
  };
}

/** Start the Tor service via systemctl or directly */
export async function startTor(): Promise<{ success: boolean; message: string; status: string }> {
  const running = await checkTorRunning();
  if (running) return { success: true, message: "Tor is already running", status: "running" };

  await addLog("Attempting to start Tor service...", "info", "tor");
  const systemctl = await runCommand("systemctl start tor 2>&1");
  if (systemctl.success) {
    await addLog("Tor started via systemctl", "info", "tor");
    return { success: true, message: "Tor service started successfully", status: "running" };
  }

  const torStart = await runCommand("tor &");
  if (torStart.success) {
    await addLog("Tor started directly", "info", "tor");
    return { success: true, message: "Tor started", status: "running" };
  }

  await addLog(`Failed to start Tor: ${systemctl.stderr}`, "error", "tor");
  return {
    success: false,
    message: "Could not start Tor. Ensure Tor is installed and you have sufficient privileges.",
    status: "stopped",
  };
}

/** Stop the Tor service */
export async function stopTor(): Promise<{ success: boolean; message: string; status: string }> {
  await addLog("Stopping Tor service...", "info", "tor");
  const systemctl = await runCommand("systemctl stop tor 2>&1");
  if (systemctl.success) {
    await addLog("Tor stopped via systemctl", "info", "tor");
    return { success: true, message: "Tor service stopped", status: "stopped" };
  }
  const pkill = await runCommand("pkill tor 2>&1");
  if (pkill.success) {
    await addLog("Tor process killed", "info", "tor");
    return { success: true, message: "Tor process terminated", status: "stopped" };
  }
  return { success: false, message: "Could not stop Tor", status: "unknown" };
}

/**
 * Request a new Tor identity by sending NEWNYM via the Tor control port.
 * This causes Tor to pick a new exit node (new IP address).
 */
export async function requestNewIdentity(): Promise<{ success: boolean; message: string; status: string }> {
  await addLog("Requesting new Tor identity (NEWNYM)...", "info", "tor");

  // Method 1: netcat via tor control port 9051
  const nc = await runCommand(
    `echo -e 'AUTHENTICATE ""\r\nSIGNAL NEWNYM\r\nQUIT\r\n' | nc -w 3 127.0.0.1 9051 2>&1`
  );
  if (nc.success && (nc.stdout.includes("250") || nc.stdout.toLowerCase().includes("ok"))) {
    await addLog("New Tor identity acquired successfully", "info", "tor");
    return { success: true, message: "New Tor identity acquired — IP will change shortly", status: "renewed" };
  }

  // Method 2: use bash TCP redirect
  const bash = await runCommand(
    `bash -c 'exec 3<>/dev/tcp/127.0.0.1/9051; echo -e "AUTHENTICATE\r\nSIGNAL NEWNYM\r\nQUIT\r\n" >&3; cat <&3' 2>&1`
  );
  if (bash.success && bash.stdout.includes("250")) {
    await addLog("New Tor identity acquired via bash TCP", "info", "tor");
    return { success: true, message: "New Tor identity acquired", status: "renewed" };
  }

  // Method 3: Python fallback
  const py = await runCommand(
    `python3 -c "import socket; s=socket.socket(); s.connect(('127.0.0.1',9051)); s.send(b'AUTHENTICATE\\r\\nSIGNAL NEWNYM\\r\\nQUIT\\r\\n'); print(s.recv(256)); s.close()" 2>&1`
  );
  if (py.success) {
    await addLog("New Tor identity requested via Python", "info", "tor");
    return { success: true, message: "New Tor identity requested", status: "renewed" };
  }

  await addLog("New identity request failed — Tor control port may not be enabled", "warn", "tor");
  return {
    success: false,
    message: "Could not send NEWNYM. Enable Tor control port in torrc: ControlPort 9051",
    status: "failed",
  };
}

/** Check if Proxychains is installed */
export async function checkProxychainsInstalled(): Promise<{ installed: boolean; version?: string }> {
  const which = await runCommand("which proxychains4 || which proxychains");
  if (which.success) {
    const ver = await runCommand("proxychains4 -version 2>&1 || proxychains -version 2>&1");
    const match = ver.stdout.match(/proxychains (\S+)/i);
    return { installed: true, version: match?.[1] };
  }
  return { installed: false };
}

/** Install Proxychains via apt-get */
export async function installProxychains(): Promise<{ success: boolean; message: string; alreadyInstalled: boolean; version?: string }> {
  const check = await checkProxychainsInstalled();
  if (check.installed) {
    return { success: true, message: "Proxychains is already installed", alreadyInstalled: true, version: check.version };
  }

  await addLog("Attempting to install Proxychains...", "info", "install");
  const apt = await runCommand("which apt-get");
  if (apt.success) {
    const install = await runCommand("apt-get install -y proxychains4 2>&1");
    if (install.success) {
      const afterCheck = await checkProxychainsInstalled();
      await addLog("Proxychains installed via apt-get", "info", "install");
      return { success: true, message: "Proxychains4 installed via apt-get", alreadyInstalled: false, version: afterCheck.version };
    }
  }

  await addLog("Proxychains install not available in this environment", "warn", "install");
  return {
    success: false,
    message: "Proxychains installation requires root. Run: sudo apt-get install proxychains4",
    alreadyInstalled: false,
  };
}

/** Generate a proxychains.conf file content string */
export function generateProxychainsConfig(
  proxies: Array<{ type: string; host: string; port: number; username?: string | null; password?: string | null }>
): string {
  const proxyLines = proxies
    .map((p) => {
      const auth = p.username && p.password ? ` ${p.username} ${p.password}` : "";
      return `${p.type} ${p.host} ${p.port}${auth}`;
    })
    .join("\n");

  return `# ProxyChains configuration — MultiProxy Anonymous Router
# dynamic_chain: automatically skips dead proxies
dynamic_chain

# Quiet mode
quiet_mode

# Route DNS queries through the proxy chain
proxy_dns

# Timeout settings (milliseconds)
tcp_read_time_out 15000
tcp_connect_time_out 8000

[ProxyList]
# Default: Tor SOCKS5 proxy
socks5 127.0.0.1 9050
${proxyLines}
`;
}

const BACKUP_DIR = "/tmp/proxychains-backups";
const BACKUP_FILE = `${BACKUP_DIR}/proxychains.conf.bak`;

/** Backup the current proxychains.conf before making changes */
export async function backupProxychains(): Promise<{ success: boolean; message: string; status: string }> {
  const configPaths = ["/etc/proxychains4.conf", "/etc/proxychains.conf", "/tmp/proxychains.conf"];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        if (!existsSync(BACKUP_DIR)) await mkdir(BACKUP_DIR, { recursive: true });
        await copyFile(configPath, BACKUP_FILE);
        await addLog(`Proxychains config backed up from ${configPath}`, "info", "proxychains");
        return {
          success: true,
          message: `Backed up ${configPath} to ${BACKUP_FILE}`,
          status: "backed_up",
        };
      } catch (err) {
        const e = err as Error;
        await addLog(`Backup failed: ${e.message}`, "warn", "proxychains");
      }
    }
  }

  return {
    success: false,
    message: "No proxychains.conf found to backup. Create one first via Configure.",
    status: "not_found",
  };
}

/** Restore the proxychains.conf from the backup file */
export async function restoreProxychains(): Promise<{ success: boolean; message: string; status: string }> {
  if (!existsSync(BACKUP_FILE)) {
    return {
      success: false,
      message: "No backup found. Run a backup first.",
      status: "no_backup",
    };
  }

  try {
    const content = await readFile(BACKUP_FILE, "utf-8");
    const configPaths = ["/etc/proxychains4.conf", "/etc/proxychains.conf", "/tmp/proxychains.conf"];

    for (const configPath of configPaths) {
      try {
        await writeFile(configPath, content, "utf-8");
        await addLog(`Proxychains config restored to ${configPath}`, "info", "proxychains");
        return {
          success: true,
          message: `Configuration restored to ${configPath}`,
          status: "restored",
        };
      } catch {
        continue;
      }
    }
  } catch (err) {
    const e = err as Error;
    await addLog(`Restore failed: ${e.message}`, "error", "proxychains");
  }

  return {
    success: false,
    message: "Could not restore configuration. Check file permissions.",
    status: "failed",
  };
}

/** Write the generated proxychains config to disk */
export async function configureProxychains(
  proxies: Array<{ type: string; host: string; port: number; username?: string | null; password?: string | null }>
): Promise<{ success: boolean; message: string; configPath?: string; proxiesConfigured?: number }> {
  const config = generateProxychainsConfig(proxies);

  // Auto-backup before writing
  await backupProxychains();

  const configPaths = ["/etc/proxychains4.conf", "/etc/proxychains.conf", "/tmp/proxychains.conf"];
  for (const configPath of configPaths) {
    try {
      await writeFile(configPath, config, "utf-8");
      await addLog(`Proxychains configured at ${configPath} with ${proxies.length + 1} proxies`, "info", "proxychains");
      return {
        success: true,
        message: `Proxychains configured at ${configPath}`,
        configPath,
        proxiesConfigured: proxies.length + 1,
      };
    } catch {
      continue;
    }
  }

  await addLog(`Generated proxychains config (${proxies.length + 1} proxies) — requires elevated privileges to write`, "warn", "proxychains");
  return {
    success: true,
    message: `Configuration generated (${proxies.length + 1} proxies). Root required to write to /etc/proxychains4.conf`,
    proxiesConfigured: proxies.length + 1,
  };
}
