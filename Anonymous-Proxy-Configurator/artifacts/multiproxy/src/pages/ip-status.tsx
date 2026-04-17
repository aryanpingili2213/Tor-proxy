import { useGetOriginalIp, getGetOriginalIpQueryKey, useGetAnonymousIp, getGetAnonymousIpQueryKey, useRunLeakTest, getRunLeakTestQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, Globe, MapPin, RefreshCw, Activity, AlertTriangle, Fingerprint } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Client-side WebRTC leak detection
async function detectWebRTCLeak(): Promise<{ leaked: boolean; localIps: string[]; message: string }> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const ips: string[] = [];
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate) {
          pc.close();
          const leaked = ips.some(ip => !ip.startsWith('127.') && !ip.startsWith('::1'));
          resolve({ leaked, localIps: ips, message: leaked ? `WebRTC exposed IPs: ${ips.join(', ')}` : 'No WebRTC leak detected' });
          return;
        }
        const match = ice.candidate.candidate.match(/\d+\.\d+\.\d+\.\d+/g);
        if (match) ips.push(...match.filter(ip => !ips.includes(ip)));
      };
      setTimeout(() => {
        pc.close();
        resolve({ leaked: ips.length > 0, localIps: ips, message: ips.length > 0 ? `WebRTC exposed: ${ips.join(', ')}` : 'No WebRTC leaks found' });
      }, 5000);
    } catch {
      resolve({ leaked: false, localIps: [], message: 'WebRTC not supported in this browser' });
    }
  });
}

export default function IpStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testingLeak, setTestingLeak] = useState(false);
  const [leakData, setLeakData] = useState<any>(null);
  
  const [testingWebRTC, setTestingWebRTC] = useState(false);
  const [webrtcData, setWebRTCData] = useState<any>(null);

  const { data: originalIp, isLoading: loadingOriginal } = useGetOriginalIp({ query: { queryKey: getGetOriginalIpQueryKey() } });
  const { data: anonIp, isLoading: loadingAnon } = useGetAnonymousIp({ 
    query: { queryKey: getGetAnonymousIpQueryKey(), retry: false, refetchInterval: 10000 } 
  });
  
  const runLeakTest = useRunLeakTest();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOriginalIpQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAnonymousIpQueryKey() });
    setLeakData(null);
    setWebRTCData(null);
  };

  const handleLeakTest = async () => {
    setTestingLeak(true);
    try {
      const res = await runLeakTest.mutateAsync({});
      setLeakData(res);
      if (res.leaked) {
        toast({ title: "DNS Leak Detected", description: res.message, variant: "destructive" });
      } else {
        toast({ title: "Network Secure", description: "No DNS leaks detected." });
      }
    } catch (e: any) {
      toast({ title: "Test Failed", description: e.message, variant: "destructive" });
    } finally {
      setTestingLeak(false);
    }
  };

  const handleWebRTCTest = async () => {
    setTestingWebRTC(true);
    try {
      const res = await detectWebRTCLeak();
      setWebRTCData(res);
      if (res.leaked) {
        toast({ title: "WebRTC Leak Detected", description: res.message, variant: "destructive" });
      } else {
        toast({ title: "WebRTC Secure", description: res.message });
      }
    } catch (e: any) {
      toast({ title: "Test Failed", description: e.message, variant: "destructive" });
    } finally {
      setTestingWebRTC(false);
    }
  };

  const IpCard = ({ title, data, isLoading, type }: { title: string, data: any, isLoading: boolean, type: 'original' | 'anon' }) => {
    const isSuccess = data?.success;
    const isAnon = type === 'anon';
    
    return (
      <Card className={`border-border/50 bg-card/50 backdrop-blur-sm relative overflow-hidden ${isAnon && isSuccess ? 'border-primary/50' : ''}`}>
        {isAnon && isSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-primary" />}
        {!isAnon && isSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />}
        
        <CardHeader>
          <CardTitle className="font-mono flex items-center gap-2 text-lg">
            {isAnon ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
            {title}
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            {isAnon ? "Routed via Proxychains/Tor (Auto-refreshing)" : "Direct network connection"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !isSuccess ? (
            <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-md bg-muted/10">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-mono text-muted-foreground">CONNECTION FAILED</p>
              <p className="text-xs text-muted-foreground mt-1 truncate max-w-full">{data?.error || "Unable to reach check server"}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 rounded-md bg-background/80 border border-border/50 shadow-inner">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">Assigned IPv4</span>
                <span className={`text-3xl font-black font-mono tracking-tight ${isAnon ? 'text-primary' : 'text-destructive'}`}>
                  {data.ip}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm font-mono">
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
                  <div className="truncate" title={`${data.city}, ${data.region}, ${data.country}`}>
                    {data.city ? `${data.city}, ` : ''}{data.countryCode}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> ISP / ASN</span>
                  <div className="truncate" title={data.isp || data.org}>{data.isp || data.org || 'Unknown'}</div>
                </div>
                <div className="space-y-1 col-span-2 border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tor Exit Node</span>
                    {data.isTor ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 font-bold">VERIFIED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">NEGATIVE</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Globe className="h-8 w-8" />
            NETWORK_IDENTITY
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Verify your public footprint and check for leaks.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="font-mono">
          <RefreshCw className="h-4 w-4 mr-2" /> REFRESH DATA
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <IpCard title="EXPOSED IP" data={originalIp} isLoading={loadingOriginal} type="original" />
        <IpCard title="ANONYMOUS IP" data={anonIp} isLoading={loadingAnon} type="anon" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="font-mono text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> DNS LEAK TEST
              </CardTitle>
              <CardDescription className="font-mono">Check if DNS requests bypass tunnel</CardDescription>
            </div>
            <Button onClick={handleLeakTest} disabled={testingLeak} className="font-mono bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
              {testingLeak ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              RUN DNS TEST
            </Button>
          </CardHeader>
          <CardContent>
            {!leakData && !testingLeak && (
               <div className="h-24 flex items-center justify-center border border-dashed border-border/50 rounded-md bg-muted/10 text-muted-foreground font-mono text-sm text-center">
                 Run test to analyze DNS resolution path.
               </div>
            )}
            {testingLeak && (
               <div className="h-24 flex flex-col items-center justify-center space-y-3">
                 <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                 <span className="font-mono text-sm text-muted-foreground blink">ANALYZING PACKETS...</span>
               </div>
            )}
            {leakData && !testingLeak && (
              <div className={`p-4 rounded-md border ${leakData.leaked ? 'bg-destructive/10 border-destructive/30' : 'bg-green-500/10 border-green-500/30'}`}>
                 <div className="flex items-start gap-4">
                   <div className="mt-1">
                     {leakData.leaked ? <ShieldAlert className="h-6 w-6 text-destructive" /> : <ShieldCheck className="h-6 w-6 text-green-500" />}
                   </div>
                   <div className="flex-1 space-y-1">
                     <h3 className={`text-lg font-bold font-mono tracking-tight ${leakData.leaked ? 'text-destructive' : 'text-green-500'}`}>
                       {leakData.leaked ? 'LEAK DETECTED' : 'SECURE TUNNEL'}
                     </h3>
                     <p className="text-foreground/80 text-xs font-mono">{leakData.message}</p>
                     
                     {leakData.dnsServers && leakData.dnsServers.length > 0 && (
                       <div className="mt-3 pt-3 border-t border-border/50">
                         <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest block mb-1">Detected DNS Servers</span>
                         <div className="flex flex-wrap gap-1">
                           {leakData.dnsServers.map((ip: string, i: number) => (
                             <Badge key={i} variant="secondary" className="font-mono text-[10px]">{ip}</Badge>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="font-mono text-lg flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" /> WEBRTC LEAK TEST
              </CardTitle>
              <CardDescription className="font-mono">Check for browser WebRTC exposure</CardDescription>
            </div>
            <Button onClick={handleWebRTCTest} disabled={testingWebRTC} variant="secondary" className="font-mono shrink-0">
              {testingWebRTC ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-2" />}
              RUN WEBRTC TEST
            </Button>
          </CardHeader>
          <CardContent>
            {!webrtcData && !testingWebRTC && (
               <div className="h-24 flex items-center justify-center border border-dashed border-border/50 rounded-md bg-muted/10 text-muted-foreground font-mono text-sm text-center">
                 Run test to analyze local IP exposure.
               </div>
            )}
            {testingWebRTC && (
               <div className="h-24 flex flex-col items-center justify-center space-y-3">
                 <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                 <span className="font-mono text-sm text-muted-foreground blink">ESTABLISHING PEER...</span>
               </div>
            )}
            {webrtcData && !testingWebRTC && (
              <div className={`p-4 rounded-md border ${webrtcData.leaked ? 'bg-destructive/10 border-destructive/30' : 'bg-green-500/10 border-green-500/30'}`}>
                 <div className="flex items-start gap-4">
                   <div className="mt-1">
                     {webrtcData.leaked ? <ShieldAlert className="h-6 w-6 text-destructive" /> : <ShieldCheck className="h-6 w-6 text-green-500" />}
                   </div>
                   <div className="flex-1 space-y-1">
                     <h3 className={`text-lg font-bold font-mono tracking-tight ${webrtcData.leaked ? 'text-destructive' : 'text-green-500'}`}>
                       {webrtcData.leaked ? 'WEBRTC EXPOSED' : 'WEBRTC SECURE'}
                     </h3>
                     <p className="text-foreground/80 text-xs font-mono">{webrtcData.message}</p>
                     
                     {webrtcData.localIps && webrtcData.localIps.length > 0 && (
                       <div className="mt-3 pt-3 border-t border-border/50">
                         <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest block mb-1">Discovered IPs</span>
                         <div className="flex flex-wrap gap-1">
                           {webrtcData.localIps.map((ip: string, i: number) => (
                             <Badge key={i} variant="secondary" className="font-mono text-[10px]">{ip}</Badge>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
