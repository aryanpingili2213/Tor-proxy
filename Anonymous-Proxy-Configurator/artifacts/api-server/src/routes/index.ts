import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import systemRouter from "./system.js";
import proxiesRouter from "./proxies.js";
import ipRouter from "./ip.js";
import logsRouter from "./logs.js";
import openaiRouter from "./openai/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/system", systemRouter);
router.use("/proxies", proxiesRouter);
router.use("/ip", ipRouter);
router.use("/logs", logsRouter);
router.use("/openai", openaiRouter);

export default router;
