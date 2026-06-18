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

export function LayoutShell({ profile, org, children }: LayoutShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 20,
            background: "rgba(14,17,22,.65)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
          className="md:hidden"
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
          width: "224px",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 240ms cubic-bezier(.2,.7,.2,1)",
        }}
        className="md:relative md:transform-none md:!translate-x-0 md:flex md:h-full"
      >
        <NavSidebar profile={profile} org={org} />
      </div>

      {/* Main content */}
      <main
        style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", minWidth: 0 }}
      >
        {/* Mobile top bar */}
        <div
          className="md:hidden"
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            position: "sticky", top: 0, zIndex: 10,
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, color: "var(--text-muted)" }}
            className="btn-icon"
            aria-label="Open navigation"
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--accent-weak)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={12} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{org.name}</span>
          </div>
        </div>

        {children}
      </main>

      <CommandPalette isAdmin={profile.role === "admin"} />
    </div>
  );
}
