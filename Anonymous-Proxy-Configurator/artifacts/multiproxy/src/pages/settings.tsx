import { useGetConfig, getGetConfigQueryKey, useUpdateConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings2, Save, Loader2, Edit3, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const configSchema = z.object({
  torPort: z.coerce.number().min(1).max(65535),
  torControlPort: z.coerce.number().min(1).max(65535),
  rotationIntervalSeconds: z.coerce.number().min(10).max(86400),
  autoRemoveDeadProxies: z.boolean(),
  logFilePath: z.string().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: config, isLoading } = useGetConfig({ query: { queryKey: getGetConfigQueryKey() } });
  const updateConfig = useUpdateConfig();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      torPort: 9050,
      torControlPort: 9051,
      rotationIntervalSeconds: 60,
      autoRemoveDeadProxies: false,
      logFilePath: "/var/log/multiproxy.log",
    }
  });

  useEffect(() => {
    if (config) {
      form.reset({
        torPort: config.torPort,
        torControlPort: config.torControlPort,
        rotationIntervalSeconds: config.rotationIntervalSeconds,
        autoRemoveDeadProxies: config.autoRemoveDeadProxies,
        logFilePath: config.logFilePath || "",
      });
    }
  }, [config, form]);

  const onSubmit = async (data: ConfigFormValues) => {
    try {
      await updateConfig.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: getGetConfigQueryKey() });
      setIsEditing(false);
      toast({ title: "Configuration Saved", description: "System configuration updated successfully." });
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Settings2 className="h-8 w-8" />
            SYSTEM_CONFIG
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Manage core router and daemon settings.</p>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)} className="font-mono" disabled={isLoading}>
            <Edit3 className="h-4 w-4 mr-2" /> EDIT CONFIG
          </Button>
        )}
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-mono text-lg">ROUTER SETTINGS</CardTitle>
          <CardDescription className="font-mono text-xs">These settings apply to the local proxychains and tor instances.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Tor SOCKS Port</Label>
                  {isEditing ? (
                    <Input type="number" {...form.register("torPort")} className="font-mono bg-background" />
                  ) : (
                    <div className="p-3 border border-border/50 rounded-md bg-muted/20 font-mono">{config?.torPort}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Tor Control Port</Label>
                  {isEditing ? (
                    <Input type="number" {...form.register("torControlPort")} className="font-mono bg-background" />
                  ) : (
                    <div className="p-3 border border-border/50 rounded-md bg-muted/20 font-mono">{config?.torControlPort}</div>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Default Rotation Interval (s)</Label>
                  {isEditing ? (
                    <Input type="number" {...form.register("rotationIntervalSeconds")} className="font-mono bg-background" />
                  ) : (
                    <div className="p-3 border border-border/50 rounded-md bg-muted/20 font-mono">{config?.rotationIntervalSeconds}s</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Log File Path</Label>
                  {isEditing ? (
                    <Input {...form.register("logFilePath")} className="font-mono bg-background" />
                  ) : (
                    <div className="p-3 border border-border/50 rounded-md bg-muted/20 font-mono">{config?.logFilePath || "Default"}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-border/50 rounded-md bg-muted/20">
                <div className="space-y-1">
                  <Label className="font-mono text-sm">Auto-Remove Dead Proxies</Label>
                  <p className="text-xs text-muted-foreground font-mono">Automatically delete proxy nodes that fail validation multiple times.</p>
                </div>
                {isEditing ? (
                  <Controller
                    name="autoRemoveDeadProxies"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                ) : (
                  <Badge variant={config?.autoRemoveDeadProxies ? "default" : "outline"} className="font-mono">
                    {config?.autoRemoveDeadProxies ? "ENABLED" : "DISABLED"}
                  </Badge>
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsEditing(false);
                    form.reset();
                  }} className="font-mono">
                    <X className="h-4 w-4 mr-2" /> CANCEL
                  </Button>
                  <Button type="submit" disabled={updateConfig.isPending} className="font-mono">
                    {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    SAVE CONFIG
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
