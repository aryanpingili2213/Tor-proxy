import { useGetLogs, getGetLogsQueryKey, useClearLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, RefreshCw, Terminal, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Logs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  
  const { data: logs, isLoading } = useGetLogs({ 
    limit: 500, 
    level: level === "all" ? undefined : level 
  } as any, { 
    query: { 
      queryKey: [...getGetLogsQueryKey(), level],
      refetchInterval: 5000
    } 
  });

  const clearLogs = useClearLogs();

  const handleClear = async () => {
    try {
      await clearLogs.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
      toast({ title: "Logs Cleared", description: "All system logs have been removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to clear logs", variant: "destructive" });
    }
  };

  const getLevelColor = (lvl: string) => {
    switch (lvl) {
      case 'info': return 'text-green-500';
      case 'warn': return 'text-yellow-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Terminal className="h-8 w-8" />
            SYSTEM_LOGS
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="font-mono border-green-500/50 text-green-500 bg-green-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            LIVE
          </Badge>
          <Select value={level} onValueChange={(v: any) => setLevel(v)}>
            <SelectTrigger className="w-[140px] font-mono">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Level" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL LEVELS</SelectItem>
              <SelectItem value="info">INFO</SelectItem>
              <SelectItem value="warn">WARN</SelectItem>
              <SelectItem value="error">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="destructive" onClick={handleClear} disabled={clearLogs.isPending} className="font-mono">
            <Trash2 className="h-4 w-4 mr-2" /> CLEAR
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-border/50 bg-background/50 overflow-hidden flex flex-col">
        <CardContent className="p-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono">
              [ NO LOGS FOUND ]
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-220px)] w-full">
              <div className="p-4 font-mono text-sm">
                {logs.map((log) => (
                  <div key={log.id} className="mb-1.5 flex gap-4 hover:bg-muted/30 px-2 py-1 rounded-sm group transition-colors">
                    <span className="text-muted-foreground shrink-0 w-44">
                      [{format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}]
                    </span>
                    <span className={`shrink-0 w-14 font-bold ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-primary/70 shrink-0 w-32 truncate" title={log.source}>
                      {log.source}
                    </span>
                    <span className="text-foreground break-all">
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
