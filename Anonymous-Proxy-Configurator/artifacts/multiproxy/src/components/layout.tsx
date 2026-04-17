import { Link, useLocation } from "wouter";
import { Sidebar, SidebarProvider, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { LayoutDashboard, Settings2, Network, ShieldCheck, ScrollText, Activity, Settings, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "./theme-provider";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Setup & Install", href: "/setup", icon: Settings2 },
  { name: "Proxy Manager", href: "/proxies", icon: Network },
  { name: "IP Status", href: "/ip-status", icon: ShieldCheck },
  { name: "Logs", href: "/logs", icon: ScrollText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "AI Analyst", href: "/ai-analyst", icon: Bot },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="multiproxy-theme">
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full bg-background text-foreground font-sans selection:bg-primary/30">
          <Sidebar className="border-r border-border/50 bg-card/50">
            <SidebarContent>
              <div className="p-6 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold font-mono tracking-tight text-foreground leading-none">MULTIPROXY</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Anonymous Router</span>
                  </div>
                </div>
              </div>
              <SidebarGroup className="mt-6">
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <Link href={item.href} className={cn("flex items-center gap-3 px-3 py-2 rounded-md transition-colors", isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex-1 flex flex-col h-screen overflow-hidden">
            <div className="flex-1 overflow-auto">
              <div className="container mx-auto p-6 lg:p-8 max-w-7xl">
                {children}
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
