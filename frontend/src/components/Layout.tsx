import { Link, useLocation, Outlet } from "@tanstack/react-router";
import { cn } from "../lib/utils";
import { BarChart3, Database, GitBranch, Home, Network } from "lucide-react";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    name: "Traces",
    href: "/traces",
    icon: Network,
  },
  {
    name: "Logs",
    href: "/logs",
    icon: Database,
  },
  {
    name: "Graphs",
    href: "/graphs",
    icon: BarChart3,
  },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <GitBranch className="h-8 w-8 text-sidebar-primary" />
            <h1 className="text-xl font-bold text-sidebar-foreground">
              Stencil
            </h1>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
