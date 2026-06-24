"use client";

import { useState } from "react";
import { Menu, Building2 } from "lucide-react";
import { NavSidebar } from "@/components/nav-sidebar";
import { CommandPalette } from "@/components/command-palette";

interface Profile { email: string; full_name: string | null; role: "admin" | "analyst"; }
interface Org { name: string; }

interface LayoutShellProps {
  profile: Profile;
  org: Org;
  children: React.ReactNode;
}

const COLLAPSED_KEY = "klypup-sidebar-collapsed";

export function LayoutShell({ profile, org, children }: LayoutShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  }

  const sidebarW = collapsed ? 56 : 224;

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden"
          style={{
            position: "fixed", inset: 0, zIndex: 20,
            background: "rgba(14,17,22,.65)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
        />
      )}

      {/* Sidebar - fixed on mobile, in-flow on desktop */}
      <div
        className="md:relative md:!transform-none md:flex md:h-full"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
          width: sidebarW,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 240ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <NavSidebar
          profile={profile}
          org={org}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
      </div>

      {/* Desktop spacer so main content doesn't sit under the fixed sidebar */}
      <div
        className="sidebar-expand hidden md:block shrink-0"
        style={{ width: sidebarW }}
        aria-hidden="true"
      />

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", minWidth: 0 }}>
        {/* Mobile top bar - ONLY shown on mobile via className, no inline display style */}
        <div
          className="flex md:hidden items-center gap-3"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-1)",
            position: "sticky", top: 0, zIndex: 10,
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-icon flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: 8 }}
            aria-label="Open navigation"
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--surface-3)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={12} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{org.name}</span>
          </div>
        </div>

        {children}
      </main>

      <CommandPalette isAdmin={profile.role === "admin"} />
    </div>
  );
}
