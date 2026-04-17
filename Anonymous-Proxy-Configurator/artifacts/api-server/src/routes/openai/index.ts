/**
 * routes/openai/index.ts — AI Security Analyst chat routes
 *
 * Provides conversational AI powered by GPT-5.2 with deep knowledge of
 * Tor, proxies, anonymity, and cybersecurity. Each conversation is persisted
 * to the DB so history survives page refreshes.
 *
 * The AI receives live system context (Tor status, proxy count, current IP,
 * rotation state) so it can give personalized, actionable security advice.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable, proxiesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { checkTorRunning, checkTorInstalled, checkProxychainsInstalled } from "../../modules/system.js";
import { getRotationStatus } from "../../modules/rotation.js";

const router: IRouter = Router();

/** Build a live system context string for the AI system prompt */
async function buildSystemContext(): Promise<string> {
  try {
    const [torRunning, torCheck, proxychainsCheck, proxies] = await Promise.all([
      checkTorRunning(),
      checkTorInstalled(),
      checkProxychainsInstalled(),
      db.select().from(proxiesTable),
    ]);
    const rotation = getRotationStatus();
    const aliveProxies = proxies.filter((p) => p.status === "alive");
    const deadProxies = proxies.filter((p) => p.status === "dead");

    return `
LIVE SYSTEM STATUS (updated at ${new Date().toISOString()}):
- Tor: ${torRunning ? "RUNNING" : "STOPPED"} (installed: ${torCheck.installed}, version: ${torCheck.version ?? "unknown"})
- Proxychains: installed=${proxychainsCheck.installed}
- Total proxies: ${proxies.length} | Alive: ${aliveProxies.length} | Dead: ${deadProxies.length}
- Proxy rotation: ${rotation.active ? `ACTIVE (every ${rotation.intervalSeconds}s, ${rotation.rotationCount} rotations completed)` : "INACTIVE"}
- Anonymous mode: ${torRunning && proxychainsCheck.installed && aliveProxies.length > 0 ? "ENABLED" : "DISABLED/PARTIAL"}
`.trim();
  } catch {
    return "System status unavailable.";
  }
}

/** GET /openai/conversations — list all conversations */
router.get("/conversations", async (_req, res) => {
  try {
    const convs = await db
      .select()
      .from(conversationsTable)
      .orderBy(desc(conversationsTable.createdAt));
    res.json(
      convs.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt.toISOString() }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

/** POST /openai/conversations — create a new conversation */
router.post("/conversations", async (req, res) => {
  try {
    const body = req.body as { title?: string };
    const title = typeof body.title === "string" && body.title ? body.title : "Security Analysis";
    const [conv] = await db.insert(conversationsTable).values({ title }).returning();
    res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/** GET /openai/conversations/:id — get a conversation with all messages */
router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

/** DELETE /openai/conversations/:id — delete a conversation and all its messages */
router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/** GET /openai/conversations/:id/messages — list messages */
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json(msgs.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list messages" });
  }
});

/**
 * POST /openai/conversations/:id/messages — send a message, stream back the AI reply.
 *
 * The AI is given:
 *  1. A cybersecurity expert persona focused on Tor, proxies, and anonymity
 *  2. Live system context (Tor running, proxy count, rotation status)
 *  3. The full conversation history for multi-turn context
 */
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "");
    if (isNaN(id)) return res.status(400).json({ error: "Invalid conversation ID" });

    const body = req.body as { content?: string };
    const userContent = typeof body.content === "string" ? body.content.trim() : "";
    if (!userContent) return res.status(400).json({ error: "content is required" });

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // Save user message
    await db.insert(messagesTable).values({ conversationId: id, role: "user", content: userContent });

    // Load conversation history
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    const systemContext = await buildSystemContext();

    const systemPrompt = `You are an expert AI Security Analyst for the MultiProxy Anonymous Router — a cybersecurity tool that routes internet traffic through Tor and multiple proxy chains.

Your expertise covers:
- Tor network architecture, circuit building, exit nodes, hidden services
- SOCKS4/5 and HTTP proxy protocols, chaining, and authentication
- DNS leak prevention and detection (resolv.conf, DNS-over-Tor)
- WebRTC leak detection and mitigation
- Traffic fingerprinting and de-anonymization attacks
- VPN vs Tor vs Proxy tradeoffs
- Operational security (OpSec) best practices
- Linux network stack configuration (iptables, netfilter, systemd-resolved)
- Kali Linux, Debian, and Ubuntu security hardening
- Common anonymity mistakes and how to avoid them

Respond in a clear, professional, and concise way. Use markdown formatting for code, commands, and technical terms. When giving commands, always include the context (e.g. "run as root: ...").

${systemContext}`;

    // Build chat messages array with full history
    const chatMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Persist the assistant message
    await db.insert(messagesTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    // Update conversation title from first user message if still default
    if (conv.title === "Security Analysis" && history.length <= 1) {
      const title = userContent.slice(0, 60) + (userContent.length > 60 ? "..." : "");
      await db.update(conversationsTable).set({ title }).where(eq(conversationsTable.id, id));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const e = err as Error;
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed", details: e.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
