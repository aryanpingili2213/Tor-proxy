import { Router, type IRouter } from "express";
import { getLogs, clearLogs, addLog } from "../modules/logger.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const limit = parseInt(String(req.query["limit"] ?? "100")) || 100;
    const level = String(req.query["level"] ?? "all");
    const logs = await getLogs(limit, level);
    res.json(
      logs.map((l) => ({
        ...l,
        timestamp: l.timestamp.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching logs");
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.post("/clear", async (req, res) => {
  try {
    await clearLogs();
    await addLog("Logs cleared by user", "info", "system");
    res.json({ success: true, message: "Logs cleared" });
  } catch (err) {
    req.log.error({ err }, "Error clearing logs");
    res.status(500).json({ success: false, message: "Failed to clear logs" });
  }
});

export default router;
