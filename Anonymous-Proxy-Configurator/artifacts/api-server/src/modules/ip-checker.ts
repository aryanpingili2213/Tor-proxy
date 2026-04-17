import { addLog } from "./logger.js";

export interface IpInfo {
  ip?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  isp?: string;
  org?: string;
  timezone?: string;
  isTor?: boolean;
  success: boolean;
  error?: string;
}

const IP_APIS = [
  "https://ipapi.co/json/",
  "https://ip-api.com/json/?fields=status,country,countryCode,region,city,isp,org,timezone,query",
  "https://ipwhois.app/json/",
];

export async function fetchIpInfo(apiUrl?: string): Promise<IpInfo> {
  const apis = apiUrl ? [apiUrl] : IP_APIS;

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(api, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) continue;
      const data = await resp.json() as Record<string, unknown>;

      // Normalize across different API formats
      const ip = (data.ip ?? data.query ?? data.IP) as string | undefined;
      const country = (data.country_name ?? data.country ?? data.country_name) as string | undefined;
      const countryCode = (data.country_code ?? data.countryCode ?? data.country_code) as string | undefined;
      const city = (data.city) as string | undefined;
      const region = (data.region ?? data.region_name) as string | undefined;
      const isp = (data.isp ?? data.connection?.isp) as string | undefined;
      const org = (data.org ?? data.asn) as string | undefined;
      const timezone = (data.timezone) as string | undefined;

      if (ip) {
        await addLog(`IP check successful: ${ip} (${country ?? "Unknown"})`, "info", "ip-checker");
        return { ip, country, countryCode, city, region, isp, org, timezone, success: true };
      }
    } catch (err) {
      // Try next API
    }
  }

  await addLog("All IP check APIs failed", "warn", "ip-checker");
  return { success: false, error: "Could not fetch IP information. Check your network connection." };
}

export async function checkDnsLeak(): Promise<{
  leaked: boolean;
  dnsServers: string[];
  message: string;
  details?: string;
  testedAt: string;
}> {
  await addLog("Running DNS leak test...", "info", "dns-leak");
  const testedAt = new Date().toISOString();

  try {
    // Fetch DNS from multiple services to detect leaks
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch("https://api.dnsleaktest.com/test/simple", { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json() as Array<{ ip?: string; host?: string }>;
      const dnsServers = data.map((r) => r.ip ?? r.host ?? "unknown").filter(Boolean);
      await addLog(`DNS leak test complete: ${dnsServers.length} DNS servers found`, "info", "dns-leak");
      return {
        leaked: dnsServers.length > 1,
        dnsServers,
        message: dnsServers.length > 1
          ? `Warning: ${dnsServers.length} DNS servers detected — possible DNS leak`
          : "DNS looks clean — only 1 server detected",
        testedAt,
      };
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: try to determine DNS via system
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const result = await execAsync("cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}'");
    const dnsServers = result.stdout.trim().split("\n").filter(Boolean);

    if (dnsServers.length > 0) {
      await addLog(`DNS servers from resolv.conf: ${dnsServers.join(", ")}`, "info", "dns-leak");
      const hasTorDns = dnsServers.some((s) => s === "127.0.0.1");
      return {
        leaked: !hasTorDns,
        dnsServers,
        message: hasTorDns
          ? "DNS routed through Tor (127.0.0.1)"
          : `DNS servers: ${dnsServers.join(", ")} — may not be using Tor DNS`,
        details: "Read from /etc/resolv.conf",
        testedAt,
      };
    }
  } catch {
    // ignore
  }

  return {
    leaked: false,
    dnsServers: [],
    message: "DNS leak test could not be completed — external API unavailable",
    details: "For a full test, visit dnsleaktest.com",
    testedAt,
  };
}
