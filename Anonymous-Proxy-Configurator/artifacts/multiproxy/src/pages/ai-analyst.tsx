/**
 * AI Security Analyst page
 * Full-featured chat UI backed by GPT-5.2 with live system context.
 * The AI knows your Tor status, proxy count, rotation state and gives
 * personalized cybersecurity advice.
 */
import { useListOpenaiConversations, getListOpenaiConversationsQueryKey, useCreateOpenaiConversation, useGetOpenaiConversation, getGetOpenaiConversationQueryKey, useDeleteOpenaiConversation } from "@workspace/api-client-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";

// SSE streaming helper
async function streamMessage(
  conversationId: number,
  content: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${BASE}/api/openai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok || !res.body) {
    onError("Failed to reach AI. Please try again.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.content) onChunk(parsed.content);
        if (parsed.done) onDone();
        if (parsed.error) onError(parsed.error);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

// Simple markdown-style renderer for the terminal aesthetic
function renderMessage(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("```")) {
      return <div key={i} className="text-primary/60 font-mono text-xs">{line}</div>;
    }
    if (line.startsWith("# ")) {
      return <div key={i} className="text-primary font-bold font-mono mt-2">{line.slice(2)}</div>;
    }
    if (line.startsWith("## ")) {
      return <div key={i} className="text-primary/80 font-semibold font-mono mt-1">{line.slice(3)}</div>;
    }
    if (line.startsWith("- ")) {
      return <div key={i} className="ml-2 font-mono text-sm before:content-['>_'] before:text-primary before:mr-1">{line.slice(2)}</div>;
    }
    if (line.startsWith("> ")) {
      return <div key={i} className="border-l-2 border-primary/50 pl-3 text-muted-foreground font-mono text-sm italic">{line.slice(2)}</div>;
    }
    return <div key={i} className="font-mono text-sm leading-relaxed">{line || <br />}</div>;
  });
}

const SUGGESTED_PROMPTS = [
  "Analyze my current security posture and give recommendations",
  "Is my Tor setup properly configured? What could be improved?",
  "Explain DNS leak risks and how to prevent them",
  "What proxies should I add for better anonymity?",
  "How do I verify my traffic is actually going through Tor?",
  "What are the biggest mistakes people make with Tor + proxies?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function AiAnalyst() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations, isLoading: loadingConvs } = useListOpenaiConversations({
    query: { queryKey: getListOpenaiConversationsQueryKey() },
  });

  const { data: convData } = useGetOpenaiConversation(activeConvId ?? 0, {
    query: {
      queryKey: getGetOpenaiConversationQueryKey(activeConvId ?? 0),
      enabled: !!activeConvId,
    },
  });

  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();

  // Sync messages when conversation data loads
  useEffect(() => {
    if (convData?.messages) {
      setMessages(
        convData.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }, [convData]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const startNewConversation = async () => {
    try {
      const conv = await createConv.mutateAsync({ data: { title: "Security Analysis" } });
      setActiveConvId(conv.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    } catch {
      toast({ title: "Failed to start conversation", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteConv.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;

      let convId = activeConvId;
      if (!convId) {
        try {
          const conv = await createConv.mutateAsync({ data: { title: "Security Analysis" } });
          convId = conv.id;
          setActiveConvId(conv.id);
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        } catch {
          toast({ title: "Failed to start conversation", variant: "destructive" });
          return;
        }
      }

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content }]);
      setIsStreaming(true);

      // Add a placeholder streaming message
      setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

      await streamMessage(
        convId,
        content,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.streaming) {
              updated[updated.length - 1] = { ...last, content: last.content + chunk };
            }
            return updated;
          });
        },
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.streaming) {
              updated[updated.length - 1] = { ...last, streaming: false };
            }
            return updated;
          });
          setIsStreaming(false);
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        },
        (err) => {
          setMessages((prev) => prev.filter((m) => !m.streaming));
          setIsStreaming(false);
          toast({ title: "AI Error", description: err, variant: "destructive" });
        }
      );
    },
    [input, isStreaming, activeConvId, createConv, queryClient, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)] gap-0 -m-6 overflow-hidden">
      {/* Sidebar — conversation history */}
      <div className="w-64 shrink-0 border-r border-border/50 bg-background/50 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-sm text-primary">AI_ANALYST</span>
            <Badge variant="outline" className="ml-auto font-mono text-[10px] text-green-500 border-green-500/30 bg-green-500/10">
              GPT-5.2
            </Badge>
          </div>
          <Button
            className="w-full font-mono text-xs"
            size="sm"
            onClick={startNewConversation}
            disabled={createConv.isPending}
          >
            {createConv.isPending ? (
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-2" />
            )}
            NEW SESSION
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConvs ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-muted/30" />
              ))
            ) : !conversations?.length ? (
              <p className="text-xs text-muted-foreground font-mono text-center py-4 px-2">
                No sessions yet. Start a new one.
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer group transition-colors ${
                    activeConvId === conv.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setMessages([]);
                  }}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs truncate flex-1 text-foreground">
                    {conv.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Capabilities list */}
        <div className="p-3 border-t border-border/50 space-y-1">
          {[
            "Tor setup analysis",
            "Proxy recommendations",
            "Leak detection advice",
            "OpSec best practices",
          ].map((cap) => (
            <div key={cap} className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <ShieldCheck className="h-3 w-3 text-primary/60 shrink-0" />
              {cap}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-mono text-foreground mb-2">
                AI SECURITY ANALYST
              </h2>
              <p className="text-sm text-muted-foreground font-mono mb-6">
                Ask anything about your anonymity setup. I have live access to your Tor status, proxy chain, and system configuration.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    className="text-left px-3 py-2 rounded-md border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-colors text-xs font-mono text-muted-foreground hover:text-foreground"
                  >
                    <Zap className="h-3 w-3 inline mr-2 text-primary/60" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
                      msg.role === "user"
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/50 border-border/50"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-lg border text-sm ${
                      msg.role === "user"
                        ? "bg-primary/10 border-primary/20 text-foreground ml-auto"
                        : "bg-card/50 border-border/50 text-foreground"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="font-mono text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-0.5">
                        {renderMessage(msg.content)}
                        {msg.streaming && (
                          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-bottom" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-4 bg-background/80">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Tor config, proxy setup, DNS leaks, OpSec..."
              className="font-mono text-sm resize-none bg-muted/20 border-border/50 focus:border-primary/50 min-h-[44px] max-h-[200px]"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              onClick={() => send()}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 h-[44px] w-[44px] p-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono text-center mt-2">
            Press Enter to send, Shift+Enter for newline. The AI has live access to your system status.
          </p>
        </div>
      </div>
    </div>
  );
}
