"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard, Search, History, Bookmark,
  Users, LogOut, Moon, Sun, Building2, Command,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";

interface Profile { email: string; full_name: string | null; role: "admin" | "analyst"; }
interface Org { name: string; }

const NAV = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/research/new", label: "New Research", icon: Search },
  { href: "/history",      label: "History",      icon: History },
  { href: "/watchlist",    label: "Watchlist",    icon: Bookmark },
];
const ADMIN_NAV = [{ href: "/admin", label: "Admin", icon: Users }];

interface NavSidebarProps {
  profile: Profile;
  org: Org;
  collapsed: boolean;
  onToggle: () => void;
}

export function NavSidebar({ profile, org, collapsed, onToggle }: NavSidebarProps) {
  const pathname          = usePathname();
  const router            = useRouter();
  const { theme, toggle } = useTheme();

  const navRef               = useRef<HTMLElement>(null);
  const [indY, setIndY]      = useState(0);
  const [indH, setIndH]      = useState(32);
  const [indReady, setReady] = useState(false);

  useEffect(() => {
    if (!navRef.current || collapsed) return;
    const el = navRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (!el) return;
    const navTop = navRef.current.getBoundingClientRect().top;
    const rect   = el.getBoundingClientRect();
    setIndY(rect.top - navTop);
    setIndH(rect.height);
    if (!indReady) setTimeout(() => setReady(true), 60);
  }, [pathname, collapsed, indReady]);

  async function handleLogout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function fireCmd() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }

  const items       = profile.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;
  const displayName = profile.full_name || profile.email.split("@")[0];
  const initial     = displayName[0].toUpperCase();

  return (
    <aside
      className="sidebar-expand flex h-full shrink-0 flex-col"
      style={{
        width: collapsed ? 56 : 224,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {/* Org header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: "14px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 28, height: 28, minWidth: 28, borderRadius: 8,
            background: "var(--accent-weak)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Building2 size={14} strokeWidth={1.5} />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
            {org.name}
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav ref={navRef} className="flex flex-1 flex-col gap-0.5 p-2" style={{ position: "relative" }}>
        {/* Sliding glowing indicator — only in expanded mode */}
        {!collapsed && indY > 0 && (
          <div
            className="nav-indicator"
            style={{
              top: indY + 6, height: indH - 12,
              transition: indReady
                ? "top 230ms cubic-bezier(.2,.7,.2,1), height 230ms cubic-bezier(.2,.7,.2,1)"
                : "none",
            }}
          />
        )}

        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          if (collapsed) {
            return (
              <Link
                key={href}
                href={href}
                data-active={active ? "true" : "false"}
                data-tooltip={label}
                className={cn("nav-link sidebar-tooltip flex items-center justify-center rounded-lg py-2 text-sm font-medium", active && "active")}
                style={{ minHeight: 36 }}
              >
                <Icon size={15} strokeWidth={1.5} />
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              data-active={active ? "true" : "false"}
              className={cn("nav-link flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium", active && "active")}
              style={{ minHeight: 36 }}
            >
              <Icon size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div style={{ borderTop: "1px solid var(--border)", padding: collapsed ? "10px 6px 12px" : "10px 8px 12px" }}>
        {/* User identity — only when expanded */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 10px" }}>
            <div
              style={{
                width: 24, height: 24, minWidth: 24, borderRadius: "50%",
                background: "var(--accent-weak)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>{displayName}</p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{profile.role}</p>
            </div>
          </div>
        )}

        {/*
          Action row layout:
          Expanded:  [theme] [cmd]  ─── spacer ───  [logout] [collapse]
          Collapsed: vertical column of all four
        */}
        <div
          style={{
            display: "flex",
            flexDirection: collapsed ? "column" : "row",
            alignItems: "center",
            gap: 2,
            padding: collapsed ? "0 2px" : "0 2px",
          }}
        >
          {/* Theme toggle */}
          {collapsed ? (
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              data-tooltip={theme === "dark" ? "Light mode" : "Dark mode"}
              className="btn-icon sidebar-tooltip flex h-9 w-9 items-center justify-center rounded-lg"
            >
              {theme === "dark" ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
            </button>
          ) : (
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg"
            >
              {theme === "dark" ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
            </button>
          )}

          {/* Command palette */}
          {collapsed ? (
            <button
              onClick={fireCmd}
              aria-label="Command palette"
              data-tooltip="⌘K"
              className="btn-icon sidebar-tooltip flex h-9 w-9 items-center justify-center rounded-lg"
            >
              <Command size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={fireCmd}
              aria-label="Command palette"
              title="⌘K"
              className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <Command size={14} strokeWidth={1.5} />
            </button>
          )}

          {/* Push logout + collapse to the right edge in expanded mode */}
          {!collapsed && <div style={{ flex: 1 }} />}

          {/* Logout */}
          {collapsed ? (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              data-tooltip="Sign out"
              className="btn-icon sidebar-tooltip flex h-9 w-9 items-center justify-center rounded-lg"
            >
              <LogOut size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <LogOut size={14} strokeWidth={1.5} />
            </button>
          )}

          {/* Collapse toggle — immediately next to logout */}
          {collapsed ? (
            <button
              onClick={onToggle}
              aria-label="Expand sidebar"
              data-tooltip="Expand"
              className="btn-icon sidebar-tooltip flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              <ChevronRight size={12} strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              <ChevronLeft size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
