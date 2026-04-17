import { Layout } from "@/components/layout";
import { 
  useGetSystemStatus, 
  getGetSystemStatusQueryKey, 
  useGetAnonymousIp, 
  getGetAnonymousIpQueryKey,
  useGetSystemInfo,
  getGetSystemInfoQueryKey,
  useGetRotationStatus,
  getGetRotationStatusQueryKey,
  useStartProxyRotation,
  useStopProxyRotation,
  useRequestNewIdentity
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ShieldCheck, ShieldAlert, Network, Server, Globe, Cpu, MemoryStick, RefreshCw, Zap, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: status, isLoading: loadingStatus } = useGetSystemStatus({ 
    query: { queryKey: getGetSystemStatusQueryKey() } 
  });
  
  const { data: anonIp, isLoading: loadingIp } = useGetAnonymousIp({ 
    query: { queryKey: getGetAnonymousIpQueryKey(), retry: false } 
  });

  const { data: sysInfo, isLoading: loadingSysInfo } = useGetSystemInfo({
    query: { queryKey: getGetSystemInfoQueryKey(), refetchInterval: 5000 }
  });

  const { data: rotationStatus, isLoading: loadingRotation } = useGetRotationStatus({
    query: { queryKey: getGetRotationStatusQueryKey(), refetchInterval: 5000 }
  });

  const requestNewIdentity = useRequestNewIdentity();
  const startRotation = useStartProxyRotation();
  const stopRotation = useStopProxyRotation();

  const [rotationInterval, setRotationInterval] = useState("60");

  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnonymousIpQueryKey() });
    }, 10000);
    return () => clearInterval(timer);
  }, [queryClient]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAnonymousIpQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSystemInfoQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRotationStatusQueryKey() });
  };

  const handleNewIdentity = async () => {
    try {
      await requestNewIdentity.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getGetAnonymousIpQueryKey() });
      toast({ title: "New Identity Requested", description: "Tor is acquiring a new circuit." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleStartRotation = async () => {
    try {
      await startRotation.mutateAsync({ data: { intervalSeconds: parseInt(rotationInterval, 10) } });
      queryClient.invalidateQueries({ queryKey: getGetRotationStatusQueryKey() });
      toast({ title: "Rotation Started", description: `Rotating proxies every ${rotationInterval}s.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleStopRotation = async () => {
    try {
      await stopRotation.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: getGetRotationStatusQueryKey() });
      toast({ title: "Rotation Stopped" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const isProtected = status?.torRunning && status?.proxychainsConfigured && status?.activeProxyCount > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mission Control</h1>
          <p className="text-muted-foreground mt-1">System overview and anonymity status.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={handleNewIdentity} 
            disabled={requestNewIdentity.isPending}
            className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-400 font-mono shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
          >
            {requestNewIdentity.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            NEW IDENTITY
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <Activity className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Status Card */}
        <Card className="lg:col-span-2 relative overflow-hidden bg-card/50 border-border/50 backdrop-blur-sm">
          <div className={`absolute top-0 left-0 w-1 h-full ${isProtected ? 'bg-green-500' : 'bg-destructive'}`} />
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              GLOBAL STATUS
              <span className="relative flex h-3 w-3 ml-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status?.torRunning ? 'bg-green-400' : 'bg-destructive'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${status?.torRunning ? 'bg-green-500' : 'bg-destructive'}`}></span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <Skeleton className="h-24 w-full bg-muted/50" />
            ) : (
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 flex items-center justify-center md:justify-start gap-4">
                  <div className={`p-4 rounded-full ${isProtected ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {isProtected ? <ShieldCheck className="h-12 w-12" /> : <ShieldAlert className="h-12 w-12" />}
                  </div>
                  <div>
                    <h2 className={`text-3xl font-black tracking-tight ${isProtected ? 'text-green-500' : 'text-destructive'}`}>
                      {isProtected ? "PROTECTED" : "EXPOSED"}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {isProtected ? "Traffic routed through Tor and Proxies." : "System requires configuration or startup."}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 flex-1 w-full text-sm font-mono border-l border-border/50 pl-6">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Tor Network:</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${status?.torRunning ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>{status?.torRunning ? 'Running' : 'Stopped'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Active Proxies:</span>
                    <div className="flex items-center gap-2 text-primary">
                      {status?.activeProxyCount} / {status?.proxyCount}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Proxychains:</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${status?.proxychainsConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span>{status?.proxychainsConfigured ? 'Configured' : 'Pending'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Uptime:</span>
                    <div>{status?.uptime || 'N/A'}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current IP Card */}
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 font-mono">
              <Globe className="h-5 w-5 text-primary" /> EXIT NODE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingIp ? (
              <Skeleton className="h-24 w-full bg-muted/50" />
            ) : anonIp?.success ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-mono uppercase">Current IP</span>
                  <div className="text-2xl font-bold tracking-tight text-primary font-mono">{anonIp.ip}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Location</div>
                  <div className="text-right truncate">{anonIp.city ? `${anonIp.city}, ` : ''}{anonIp.countryCode}</div>
                  <div className="text-muted-foreground">ISP</div>
                  <div className="text-right truncate" title={anonIp.isp}>{anonIp.isp || 'Unknown'}</div>
                  <div className="text-muted-foreground">Tor Exit</div>
                  <div className="text-right">{anonIp.isTor ? <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">YES</Badge> : <Badge variant="outline">NO</Badge>}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 text-center">
                <p className="text-sm text-muted-foreground mb-4">Unable to fetch anonymous IP.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/setup">Configure Routing</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* System Components */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-lg">
              <Server className="h-5 w-5 text-primary" /> COMPONENTS
            </CardTitle>
          </CardHeader>
          <CardContent>
             {loadingStatus ? <Skeleton className="h-32 bg-muted/50" /> : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${status?.torInstalled ? 'bg-green-500' : 'bg-destructive'}`} />
                    <span className="font-mono text-sm">Tor Core</span>
                  </div>
                  <Badge variant={status?.torInstalled ? "outline" : "destructive"} className="font-mono">
                    {status?.torVersion || (status?.torInstalled ? 'Installed' : 'Missing')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${status?.proxychainsInstalled ? 'bg-green-500' : 'bg-destructive'}`} />
                    <span className="font-mono text-sm">Proxychains-NG</span>
                  </div>
                  <Badge variant={status?.proxychainsInstalled ? "outline" : "destructive"} className="font-mono">
                    {status?.proxychainsVersion || (status?.proxychainsInstalled ? 'Installed' : 'Missing')}
                  </Badge>
                </div>
              </div>
             )}
          </CardContent>
        </Card>

        {/* System Performance */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-lg">
              <Activity className="h-5 w-5 text-primary" /> PERFORMANCE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSysInfo ? <Skeleton className="h-32 bg-muted/50" /> : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-sm text-muted-foreground font-mono">Distro</span>
                  <Badge variant="outline" className="font-mono text-xs">{sysInfo?.distro} {sysInfo?.distroVersion}</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-mono">
                    <span className="flex items-center gap-2 text-muted-foreground"><Cpu className="h-4 w-4" /> CPU</span>
                    <span>{sysInfo?.cpuUsagePercent}%</span>
                  </div>
                  <Progress value={sysInfo?.cpuUsagePercent} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-mono">
                    <span className="flex items-center gap-2 text-muted-foreground"><MemoryStick className="h-4 w-4" /> RAM</span>
                    <span>{sysInfo?.ramUsedMb}MB / {sysInfo?.ramTotalMb}MB</span>
                  </div>
                  <Progress value={sysInfo?.ramUsagePercent} className="h-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rotation Status */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-lg">
              <RefreshCw className={`h-5 w-5 text-primary ${rotationStatus?.active ? 'animate-spin-slow' : ''}`} /> ROTATION
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRotation ? <Skeleton className="h-32 bg-muted/50" /> : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-md border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-mono uppercase">Status</span>
                    <span className={`font-bold font-mono ${rotationStatus?.active ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {rotationStatus?.active ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </div>
                  {rotationStatus?.active && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-muted-foreground font-mono uppercase">Next In</span>
                      <span className="font-bold font-mono text-primary">{rotationStatus.nextRotationIn}s</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={rotationInterval} onValueChange={setRotationInterval} disabled={rotationStatus?.active}>
                    <SelectTrigger className="font-mono flex-1">
                      <SelectValue placeholder="Interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">60s</SelectItem>
                      <SelectItem value="180">3 min</SelectItem>
                      <SelectItem value="300">5 min</SelectItem>
                      <SelectItem value="600">10 min</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {rotationStatus?.active ? (
                    <Button variant="destructive" size="icon" onClick={handleStopRotation} disabled={stopRotation.isPending}>
                      {stopRotation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button variant="default" size="icon" onClick={handleStartRotation} disabled={startRotation.isPending}>
                      {startRotation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground font-mono text-center">
                  Total Rotations: {rotationStatus?.rotationCount || 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
