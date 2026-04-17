import * as net from "net";
import { addLog } from "./logger.js";

export interface ValidationResult {
  proxyId: number;
  host: string;
  port: number;
  alive: boolean;
  latencyMs?: number;
  message?: string;
}

export async function validateProxy(proxyId: number, host: string, port: number): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    const timeout = 8000;

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      addLog(`Proxy ${host}:${port} is alive (${latencyMs}ms)`, "info", "validator");
      resolve({ proxyId, host, port, alive: true, latencyMs, message: `Connected in ${latencyMs}ms` });
    });

    socket.on("timeout", () => {
      socket.destroy();
      addLog(`Proxy ${host}:${port} timed out after ${timeout}ms`, "warn", "validator");
      resolve({ proxyId, host, port, alive: false, message: "Connection timed out" });
    });

    socket.on("error", (err) => {
      socket.destroy();
      addLog(`Proxy ${host}:${port} connection error: ${err.message}`, "warn", "validator");
      resolve({ proxyId, host, port, alive: false, message: err.message });
    });
  });
}
