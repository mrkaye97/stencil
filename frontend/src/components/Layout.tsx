import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, Database, GitBranch, Home, Network } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

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

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex overflow-hidden">
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <GitBranch className="h-8 w-8 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Stencil</h1>
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
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-800"
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
        <main className="flex-1 p-6 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
