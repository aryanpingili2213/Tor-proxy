import { useGetSystemStatus, getGetSystemStatusQueryKey, useInstallTor, useInstallProxychains, useConfigureProxychains, useStartTor, useStopTor } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Loader2, ServerCog, Power, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Setup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: status, isLoading: loadingStatus } = useGetSystemStatus({ query: { queryKey: getGetSystemStatusQueryKey() } });

  const installTor = useInstallTor();
  const installProxychains = useInstallProxychains();
  const configProxychains = useConfigureProxychains();
  const startTor = useStartTor();
  const stopTor = useStopTor();

  const handleAction = async (action: any, name: string) => {
    try {
      const res = await action.mutateAsync({});
      toast({
        title: `${name} Successful`,
        description: res.message || `${name} completed without errors.`,
      });
      queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() });
    } catch (e: any) {
      toast({
        title: `${name} Failed`,
        description: e.message || `An error occurred during ${name}.`,
        variant: "destructive"
      });
    }
  };

  const steps = [
    {
      id: 1,
      title: "Install Tor",
      description: "Installs the core Tor routing service.",
      isComplete: status?.torInstalled,
      action: installTor,
      actionName: "Install Tor",
      buttonText: "Install Now",
    },
    {
      id: 2,
      title: "Install Proxychains",
      description: "Installs Proxychains-NG for traffic routing.",
      isComplete: status?.proxychainsInstalled,
      action: installProxychains,
      actionName: "Install Proxychains",
      buttonText: "Install Now",
    },
    {
      id: 3,
      title: "Configure Proxychains",
      description: "Generates proxychains.conf from active proxies.",
      isComplete: status?.proxychainsConfigured,
      action: configProxychains,
      actionName: "Configure Proxychains",
      buttonText: "Configure",
    }
  ];

  if (loadingStatus) {
    return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <ServerCog className="h-8 w-8" />
            SYSTEM_SETUP
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Initialize and configure routing components.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getGetSystemStatusQueryKey() })}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <Card key={step.id} className={`border border-border/50 transition-colors ${step.isComplete ? 'bg-card/30' : 'bg-card/80 border-primary/20'}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {step.isComplete ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : step.action.isPending ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <CircleDashed className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-mono font-medium text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                {step.isComplete ? (
                   <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                     <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Installed</Badge>
                     {step.id === 3 && (
                       <Button variant="secondary" size="sm" onClick={() => handleAction(step.action, step.actionName)} disabled={step.action.isPending}>
                         {step.action.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Re-configure"}
                       </Button>
                     )}
                   </div>
                ) : (
                  <Button 
                    className="w-full sm:w-auto font-mono" 
                    onClick={() => handleAction(step.action, step.actionName)}
                    disabled={step.action.isPending}
                  >
                    {step.action.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {step.buttonText}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="font-mono flex items-center gap-2 text-primary">
            <Power className="h-5 w-5" />
            SERVICE CONTROL
          </CardTitle>
          <CardDescription className="font-mono">Manage the Tor daemon process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-background/50 rounded-md border border-border/50">
            <div>
              <span className="font-mono font-medium block">Tor Service Status</span>
              <Badge variant="outline" className={status?.torRunning ? 'bg-green-500/10 text-green-500 border-green-500/20 mt-2' : 'bg-destructive/10 text-destructive border-destructive/20 mt-2'}>
                {status?.torRunning ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <div className="flex gap-3">
              {status?.torRunning ? (
                <Button variant="destructive" onClick={() => handleAction(stopTor, "Stop Tor")} disabled={stopTor.isPending} className="font-mono">
                  {stopTor.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Power className="h-4 w-4 mr-2" />}
                  STOP SERVICE
                </Button>
              ) : (
                <Button onClick={() => handleAction(startTor, "Start Tor")} disabled={startTor.isPending || !status?.torInstalled} className="font-mono bg-green-600 hover:bg-green-700 text-white">
                  {startTor.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Power className="h-4 w-4 mr-2" />}
                  START SERVICE
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
