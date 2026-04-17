/**
 * config.ts — Application configuration manager
 * Reads/writes config.json, providing typed defaults for all settings.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../../../../config.json");

export interface AppConfig {
  torPort: number;
  torControlPort: number;
  rotationIntervalSeconds: number;
  autoRemoveDeadProxies: boolean;
  logFilePath: string;
  proxychainsConfigPath: string;
  maxRetries: number;
}

/** Default configuration values */
const DEFAULTS: AppConfig = {
  torPort: 9050,
  torControlPort: 9051,
  rotationIntervalSeconds: 180,
  autoRemoveDeadProxies: false,
  logFilePath: "logs/multiproxy.log",
  proxychainsConfigPath: "/etc/proxychains4.conf",
  maxRetries: 3,
};

/** Read config from disk, falling back to defaults for missing keys */
export async function getConfig(): Promise<AppConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      await saveConfig(DEFAULTS);
      return { ...DEFAULTS };
    }
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Write config to disk, merging with defaults */
export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig();
  const merged = { ...current, ...config };
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch {
    // silently ignore write failures in read-only environments
  }
  return merged;
}
