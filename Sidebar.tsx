"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  LineChart,
  Star,
  BookOpen,
  Lightbulb,
  Settings,
  TrendingUp,
  Upload,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: LineChart },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/journal", label: "Journal", icon: BookOpen },
] as const;

const BOTTOM_ITEMS = [
  { href: "/import", label: "Import Data", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-surface border-r border-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center border-b border-border", collapsed ? "p-4 justify-center" : "px-5 py-4 gap-3")}>
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-glow">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gain border border-surface" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold text-primary leading-none">Portfolio OS</p>
            <p className="text-2xs text-muted mt-0.5">Live · GBP</p>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg transition-all duration-150 group",
                collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2",
                active
                  ? "bg-accent-glow text-accent"
                  : "text-muted hover:text-primary hover:bg-surface-3"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-accent-glow border border-accent/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn("relative z-10 shrink-0", active ? "text-accent" : "text-muted group-hover:text-primary", collapsed ? "w-4.5 h-4.5" : "w-4 h-4")} />
              {!collapsed && (
                <span className={cn("relative z-10 text-sm font-medium", active ? "text-accent" : "")}>
                  {label}
                </span>
              )}
              {!collapsed && active && (
                <ChevronRight className="relative z-10 w-3 h-3 text-accent ml-auto opacity-60" />
              )}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 bg-surface-3 border border-border rounded-md text-xs text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="py-3 px-2 space-y-0.5 border-t border-border">
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-all duration-150 group",
                collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2",
                active ? "text-accent bg-accent-glow" : "text-muted hover:text-primary hover:bg-surface-3"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 bg-surface-3 border border-border rounded-md text-xs text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}

        {/* User + logout */}
        {!collapsed ? (
          <div className="mt-3 px-3 py-2.5 bg-surface-2 rounded-lg border border-border">
            <p className="text-xs font-semibold text-primary truncate">{user?.email ?? "Personal Portfolio"}</p>
            <button
              onClick={signOut}
              className="mt-1.5 flex items-center gap-1.5 text-2xs text-muted hover:text-loss transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            title="Sign out"
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-muted hover:text-loss hover:bg-surface-2 transition-colors mt-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
