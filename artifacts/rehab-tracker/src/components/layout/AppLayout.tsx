import { Link, useLocation } from "wouter";
import { Users, Activity, Target, Home, CalendarPlus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Activity },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border flex-shrink-0 flex flex-col">
        <div className="p-6">
          <Link href="/">
            <div className="flex items-center gap-3 text-sidebar-foreground hover:opacity-80 cursor-pointer transition-opacity">
              <div className="h-8 w-8 bg-sidebar-primary rounded-md flex items-center justify-center text-sidebar-primary-foreground shadow-sm">
                <Activity size={18} strokeWidth={2.5} />
              </div>
              <span className="font-serif text-lg font-medium tracking-tight">Training Tracker</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <div className="mb-6 px-2">
            <Link href="/sessions/new">
              <Button className="w-full justify-start gap-2 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-sm" size="sm">
                <CalendarPlus size={16} />
                <span>New Session</span>
              </Button>
            </Link>
          </div>
          
          <div className="space-y-1">
            <div className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Menu</div>
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon size={18} className={isActive ? "text-sidebar-primary" : "text-muted-foreground"} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
        
        <div className="p-6 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">
              PT
            </div>
            <div className="text-sm font-medium text-sidebar-foreground">Practitioner</div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 max-w-full">
        <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
