import { Router, type IRouter } from "express";
import { fetchIpInfo, checkDnsLeak } from "../modules/ip-checker.js";

const router: IRouter = Router();

router.get("/original", async (req, res) => {
  try {
    const info = await fetchIpInfo();
    res.json(info);
  } catch (err) {
    req.log.error({ err }, "Error fetching original IP");
    res.status(500).json({ success: false, error: "Failed to fetch IP info" });
  }
});

router.get("/anonymous", async (req, res) => {
  try {
    // When Tor is running, this will be the Tor exit node IP
    // For now we call the same endpoint — if Tor is configured as system proxy, it'll go through Tor
    const info = await fetchIpInfo();
    res.json(info);
  } catch (err) {
    req.log.error({ err }, "Error fetching anonymous IP");
    res.status(500).json({ success: false, error: "Failed to fetch anonymous IP info" });
  }
});

router.get("/leak-test", async (req, res) => {
  try {
    const result = await checkDnsLeak();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error running DNS leak test");
    res.status(500).json({
      leaked: false,
      dnsServers: [],
      message: "DNS leak test failed",
      testedAt: new Date().toISOString(),
    });
  }
});

export default router;
