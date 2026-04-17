import { 
  useListProxies, 
  getListProxiesQueryKey, 
  useAddProxy, 
  useDeleteProxy, 
  useValidateProxy, 
  useValidateAllProxies, 
  useConfigureProxychains, 
  getGetSystemStatusQueryKey,
  useBulkUploadProxies,
  useRemoveDeadProxies
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Network, Plus, Trash2, Activity, ShieldCheck, Zap, Loader2, UploadCloud, Skull } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const proxySchema = z.object({
  type: z.enum(["socks5", "socks4", "http", "https"]),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  enabled: z.boolean().default(true),
});

type ProxyFormValues = z.infer<typeof proxySchema>;

export default function Proxies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState<"socks5" | "socks4" | "http" | "https">("socks5");

  const { data: proxies, isLoading } = useListProxies({ query: { queryKey: getListProxiesQueryKey() } });
  
  const addProxy = useAddProxy();
  const deleteProxy = useDeleteProxy();
  const validateProxy = useValidateProxy();
  const validateAll = useValidateAllProxies();
  const configureProxychains = useConfigureProxychains();
  const bulkUpload = useBulkUploadProxies();
  const removeDead = useRemoveDeadProxies();

  const form = useForm<ProxyFormValues>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      type: "socks5",
      host: "",
      port: 1080,
      username: "",
      password: "",
      enabled: true,
    }
  });

  const onSubmit = async (data: ProxyFormValues) => {
    try {
      await addProxy.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      setIsAddOpen(false);
      form.reset();
      toast({ title: "Proxy Added", description: "The proxy has been saved successfully." });
    } catch (e: any) {
      toast({ title: "Error adding proxy", description: e.message, variant: "destructive" });
    }
  };

  const handleBulkSubmit = async () => {
    try {
      const res = await bulkUpload.mutateAsync({ data: { text: bulkText, defaultType: bulkType } });
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      setIsBulkOpen(false);
      setBulkText("");
      toast({ 
        title: "Bulk Import Complete", 
        description: `Added: ${res.added}, Skipped: ${res.skipped}, Errors: ${res.errors}` 
      });
    } catch (e: any) {
      toast({ title: "Import Error", description: e.message, variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setBulkText(content);
    };
    reader.readAsText(file);
  };

  const handleRemoveDead = async () => {
    try {
      const res = await removeDead.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      toast({ title: "Cleanup Complete", description: res.message });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProxy.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      toast({ title: "Proxy Deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleValidate = async (id: number) => {
    try {
      const res = await validateProxy.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      if (res.alive) {
         toast({ title: "Validation Passed", description: `Latency: ${res.latencyMs}ms` });
      } else {
         toast({ title: "Validation Failed", description: res.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleValidateAll = async () => {
    try {
      await validateAll.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      toast({ title: "Validation Complete", description: "All proxies have been checked." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleApplyConfig = async () => {
    try {
      const res = await configureProxychains.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      toast({ title: "Configuration Applied", description: `Configured ${res.proxiesConfigured} active proxies in proxychains.conf.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'alive': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'dead': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'checking': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getRatingBadge = (latencyMs?: number) => {
    if (!latencyMs) return <Badge variant="outline" className="text-muted-foreground border-border bg-muted/20">UNRATED</Badge>;
    if (latencyMs < 200) return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">FAST</Badge>;
    if (latencyMs < 500) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30">MEDIUM</Badge>;
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30">SLOW</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Network className="h-8 w-8" />
            PROXY_MANAGER
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Configure and validate your routing nodes.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleRemoveDead} disabled={removeDead.isPending} className="font-mono text-destructive border-destructive/50 hover:bg-destructive/10">
            {removeDead.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Skull className="h-4 w-4 mr-2" />}
            REMOVE DEAD
          </Button>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-mono">
                <UploadCloud className="h-4 w-4 mr-2" /> BULK IMPORT
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] border-primary/20 bg-background/95 backdrop-blur-md">
              <DialogHeader>
                <DialogTitle className="font-mono">BULK IMPORT PROXIES</DialogTitle>
                <DialogDescription>Paste proxies (host:port or type:host:port) or upload a txt file.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Label className="font-mono text-xs uppercase">Default Protocol</Label>
                    <Select value={bulkType} onValueChange={(v: any) => setBulkType(v)}>
                      <SelectTrigger className="font-mono bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="socks5">SOCKS5</SelectItem>
                        <SelectItem value="socks4">SOCKS4</SelectItem>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label className="font-mono text-xs uppercase">Upload File</Label>
                    <Input type="file" accept=".txt" onChange={handleFileUpload} className="font-mono bg-card" />
                  </div>
                </div>
                <Textarea 
                  placeholder="192.168.1.1:1080&#10;socks4:10.0.0.1:8080" 
                  className="font-mono min-h-[200px] bg-card"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkSubmit} disabled={bulkUpload.isPending || !bulkText.trim()} className="w-full font-mono">
                  {bulkUpload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  IMPORT LIST
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleValidateAll} disabled={validateAll.isPending || !proxies?.length} className="font-mono">
            {validateAll.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            VALIDATE ALL
          </Button>
          <Button variant="secondary" onClick={handleApplyConfig} disabled={configureProxychains.isPending || !proxies?.length} className="font-mono">
            <ShieldCheck className="h-4 w-4 mr-2" /> APPLY CONFIG
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono">
                <Plus className="h-4 w-4 mr-2" /> ADD NODE
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/20 bg-background/95 backdrop-blur-md">
              <DialogHeader>
                <DialogTitle className="font-mono">NEW_PROXY_NODE</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Type</Label>
                    <Controller
                      name="type"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="font-mono bg-card">
                            <SelectValue placeholder="Protocol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="socks5">SOCKS5</SelectItem>
                            <SelectItem value="socks4">SOCKS4</SelectItem>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="https">HTTPS</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Port</Label>
                    <Input type="number" {...form.register("port")} className="font-mono bg-card" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Host / IP</Label>
                  <Input placeholder="127.0.0.1" {...form.register("host")} className="font-mono bg-card" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Username (Optional)</Label>
                    <Input {...form.register("username")} className="font-mono bg-card" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Password (Optional)</Label>
                    <Input type="password" {...form.register("password")} className="font-mono bg-card" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border border-border/50 rounded-md bg-muted/20">
                  <Label className="font-mono text-sm">Enable by default</Label>
                  <Controller
                    name="enabled"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
                <Button type="submit" className="w-full font-mono" disabled={addProxy.isPending}>
                  {addProxy.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  SAVE NODE
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-mono text-xs w-[80px]">TYPE</TableHead>
                <TableHead className="font-mono text-xs">NODE</TableHead>
                <TableHead className="font-mono text-xs">STATUS</TableHead>
                <TableHead className="font-mono text-xs">RATING</TableHead>
                <TableHead className="font-mono text-xs text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : !proxies?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-mono">
                    NO PROXIES CONFIGURED
                  </TableCell>
                </TableRow>
              ) : (
                proxies.map((proxy) => (
                  <TableRow key={proxy.id} className="group">
                    <TableCell>
                      <Badge variant="outline" className="font-mono uppercase bg-background">{proxy.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono flex flex-col">
                        <span className={!proxy.enabled ? "text-muted-foreground line-through" : ""}>
                          {proxy.host}:{proxy.port}
                        </span>
                        {proxy.username && <span className="text-[10px] text-muted-foreground">Auth: {proxy.username}:***</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline" className={`font-mono uppercase ${getStatusColor(proxy.status)}`}>
                          {proxy.status}
                        </Badge>
                        {proxy.lastChecked && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(proxy.lastChecked))} ago
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRatingBadge(proxy.latencyMs)}
                        {proxy.latencyMs && (
                          <span className="font-mono text-xs text-muted-foreground">{proxy.latencyMs}ms</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleValidate(proxy.id)}
                          disabled={validateProxy.isPending && validateProxy.variables?.id === proxy.id}
                          title="Check connection"
                        >
                          {validateProxy.isPending && validateProxy.variables?.id === proxy.id ? 
                            <Loader2 className="h-4 w-4 animate-spin" /> : 
                            <Activity className="h-4 w-4" />
                          }
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handleDelete(proxy.id)}
                          disabled={deleteProxy.isPending && deleteProxy.variables?.id === proxy.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
