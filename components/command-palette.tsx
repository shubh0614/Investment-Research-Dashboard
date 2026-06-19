"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, History, Bookmark, Users, Sparkles } from "lucide-react";

const ALL_ITEMS = [
  { label: "Dashboard",    desc: "Your research home",   href: "/dashboard",    icon: LayoutDashboard, admin: false },
  { label: "New Research", desc: "Run an AI query",      href: "/research/new", icon: Sparkles,        admin: false },
  { label: "History",      desc: "All saved reports",    href: "/history",      icon: History,         admin: false },
  { label: "Watchlist",    desc: "Tracked tickers",      href: "/watchlist",    icon: Bookmark,        admin: false },
  { label: "Admin Panel",  desc: "Members & invite code",href: "/admin",        icon: Users,           admin: true  },
];

interface CommandPaletteProps { isAdmin: boolean; }

export function CommandPalette({ isAdmin }: CommandPaletteProps) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [cursor, setCursor]   = useState(0);
  const router                = useRouter();
  const inputRef              = useRef<HTMLInputElement>(null);

  const items = ALL_ITEMS.filter((i) => {
    if (i.admin && !isAdmin) return false;
    if (!query) return true;
    return i.label.toLowerCase().includes(query.toLowerCase()) ||
           i.desc.toLowerCase().includes(query.toLowerCase());
  });

  const close = useCallback(() => { setOpen(false); setQuery(""); setCursor(0); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => { if (!o) { setQuery(""); setCursor(0); } return !o; });
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  if (!open) return null;

  function navigate(href: string) { router.push(href); close(); }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "18vh" }}>
      {/* backdrop */}
      <div
        onClick={close}
        style={{ position: "absolute", inset: 0, background: "rgba(14,17,22,.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />

      {/* palette */}
      <div
        className="cmd-enter"
        style={{
          position: "relative", zIndex: 1, width: "100%", maxWidth: "440px", margin: "0 16px",
          background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "14px",
          boxShadow: "0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(124,137,255,.12)",
          overflow: "hidden",
        }}
      >
        {/* search input */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && items[cursor]) navigate(items[cursor].href);
            }}
            placeholder="Jump to…"
            style={{ flex: 1, background: "transparent", outline: "none", fontSize: "14px", color: "var(--text)" }}
          />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", padding: "2px 6px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "5px", color: "var(--text-muted)" }}>
            esc
          </kbd>
        </div>

        {/* results */}
        <div style={{ padding: "6px" }}>
          {items.length === 0 ? (
            <p style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>No results</p>
          ) : items.map((item, i) => {
            const active = i === cursor;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px", width: "100%",
                  padding: "10px 12px", borderRadius: "8px", textAlign: "left",
                  background: active ? "var(--surface-3)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  transition: "background 80ms, color 80ms",
                  border: "none", cursor: "pointer",
                }}
              >
                <item.icon size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: active ? "var(--accent)" : "var(--text)" }}>{item.label}</p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{item.desc}</p>
                </div>
                {active && (
                  <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "10px", padding: "2px 5px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", flexShrink: 0 }}>
                    ↵
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ display: "flex", gap: "16px", padding: "10px 16px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
