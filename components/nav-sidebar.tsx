"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  History,
  Bookmark,
  Users,
  LogOut,
  Moon,
  Sun,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";

interface Profile {
  email: string;
  full_name: string | null;
  role: "admin" | "analyst";
}

interface Org {
  name: string;
}

const NAV = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/research/new", label: "New Research", icon: Search },
  { href: "/history",      label: "History",      icon: History },
  { href: "/watchlist",    label: "Watchlist",    icon: Bookmark },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Admin", icon: Users },
];

interface NavSidebarProps {
  profile: Profile;
  org: Org;
}

export function NavSidebar({ profile, org }: NavSidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = profile.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;

  const displayName = profile.full_name || profile.email.split("@")[0];
  const initial     = displayName[0].toUpperCase();

  return (
    <aside
      className="flex h-full w-56 shrink-0 flex-col"
      style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}
    >
      {/* Org header */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
        >
          <Building2 size={14} strokeWidth={1.5} />
        </div>
        <span
          className="truncate text-sm font-semibold"
          style={{ color: "var(--text)" }}
        >
          {org.name}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
              )}
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
                background: active ? "var(--accent-weak)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-2)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + controls */}
      <div
        className="px-2 pb-3 pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* User row */}
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-medium"
              style={{ color: "var(--text)" }}
            >
              {displayName}
            </p>
            <p
              className="truncate text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {profile.role}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-1 flex gap-1 px-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            {theme === "dark"
              ? <Sun size={14} strokeWidth={1.5} />
              : <Moon size={14} strokeWidth={1.5} />
            }
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
