import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// Pages
import Dashboard from "@/pages/dashboard";
import Setup from "@/pages/setup";
import Proxies from "@/pages/proxies";
import IpStatus from "@/pages/ip-status";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import AiAnalyst from "@/pages/ai-analyst";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/setup" component={Setup} />
        <Route path="/proxies" component={Proxies} />
        <Route path="/ip-status" component={IpStatus} />
        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route path="/ai-analyst" component={AiAnalyst} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
