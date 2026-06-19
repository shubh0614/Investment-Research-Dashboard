"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Trash2, Loader2, Search, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { Sparkline } from "./sparkline";

interface WatchlistItem { id: string; ticker: string; company_name: string; created_at: string; }
interface PriceData { price: number; change_pct: number; series: { date: string; close: number }[]; }

export default function WatchlistPage() {
  const qc = useQueryClient();
  const [ticker, setTicker]       = useState("");
  const [company, setCompany]     = useState("");
  const [formErr, setFormErr]     = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => apiFetch<{ items: WatchlistItem[] }>("/api/watchlist"),
  });

  const items = data?.items ?? [];

  const { data: priceData } = useQuery({
    queryKey: ["watchlist-prices", items.map((i) => i.ticker).join(",")],
    queryFn: async () => {
      if (!items.length) return { prices: {} };
      const tickers = items.map((i) => i.ticker).join(",");
      return apiFetch<{ prices: Record<string, PriceData> }>(`/api/market-prices?tickers=${tickers}`);
    },
    enabled: items.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const prices: Record<string, PriceData> = priceData?.prices ?? {};

  const addMut = useMutation({
    mutationFn: (body: { ticker: string; company_name: string }) =>
      apiFetch<WatchlistItem>("/api/watchlist", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      setTicker(""); setCompany(""); setFormErr(null);
      toast("Ticker added to watchlist", "success");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to add";
      setFormErr(msg);
      toast(msg, "error");
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/watchlist/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      setConfirmId(null);
      toast("Removed from watchlist", "success");
    },
    onError: () => {
      setConfirmId(null);
      toast("Failed to remove", "error");
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !company.trim()) return;
    setFormErr(null);
    addMut.mutate({ ticker: ticker.trim().toUpperCase(), company_name: company.trim() });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10 page-enter" style={{ color: "var(--text)" }}>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ letterSpacing: "-0.02em", fontFamily: "var(--font-serif)" }}
        >
          Watchlist
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Live prices and one-click research access
        </p>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-lg border p-5 reveal"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Add ticker
        </p>
        <div className="flex gap-3">
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="NVDA" maxLength={10}
            className="h-9 w-24 rounded border px-3 font-mono text-sm uppercase outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontVariantNumeric: "tabular-nums", transition: "border-color 140ms" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="NVIDIA Corporation"
            className="h-9 flex-1 rounded border px-3 text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", transition: "border-color 140ms" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <button type="submit" disabled={addMut.isPending || !ticker.trim() || !company.trim()}
            className="flex h-9 items-center gap-1.5 rounded px-4 text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer" }}>
            {addMut.isPending ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : <Plus size={13} strokeWidth={1.5} />}
            Add
          </button>
        </div>
        {formErr && <p className="mt-2 text-xs" style={{ color: "var(--neg)" }}>{formErr}</p>}
      </form>

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-lg border"
             style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <Bookmark size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tickers yet</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>Add a ticker above to track it here</p>
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-hidden rounded-lg stagger" style={{ border: "1px solid var(--border)" }}>
          {/* Table header */}
          <div
            className="grid items-center px-4 py-2"
            style={{
              gridTemplateColumns: "3.5rem 1fr 5rem 5.5rem 5rem 7rem",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Ticker</span>
            <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Company</span>
            <span className="text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Price</span>
            <span className="text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Δ 1D</span>
            <span className="text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>30D</span>
            <span className="text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Actions</span>
          </div>

          {items.map((item, i) => {
            const p = prices[item.ticker];
            const up = p ? p.change_pct >= 0 : null;

            return (
              <div
                key={item.id}
                className="grid items-center px-4 py-3"
                style={{
                  gridTemplateColumns: "3.5rem 1fr 5rem 5.5rem 5rem 7rem",
                  background: "var(--surface-1)",
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-1)"; }}
              >
                {/* Ticker */}
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
                >
                  {item.ticker}
                </span>

                {/* Company */}
                <span className="truncate text-sm" style={{ color: "var(--text)" }}>{item.company_name}</span>

                {/* Price */}
                <span className="text-right font-mono text-sm" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {p ? `$${p.price.toFixed(2)}` : <span style={{ color: "var(--text-faint)" }}>—</span>}
                </span>

                {/* Delta */}
                <span
                  className="flex items-center justify-end gap-1 font-mono text-sm"
                  style={{ color: up === null ? "var(--text-faint)" : up ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}
                >
                  {p ? (
                    <>
                      {up ? <TrendingUp size={11} strokeWidth={1.5} /> : <TrendingDown size={11} strokeWidth={1.5} />}
                      {up ? "+" : ""}{p.change_pct.toFixed(2)}%
                    </>
                  ) : "—"}
                </span>

                {/* Sparkline */}
                <div className="flex justify-end">
                  {p?.series?.length ? (
                    <Sparkline
                      data={p.series}
                      up={up ?? true}
                      width={60}
                      height={28}
                    />
                  ) : (
                    <span className="font-mono text-xs" style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/research/new?q=${encodeURIComponent(`Give me an overview of ${item.ticker}`)}`}
                    className="flex h-7 items-center gap-1 rounded border px-2 text-xs transition-colors duration-100"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
                  >
                    <Search size={10} strokeWidth={1.5} />
                    Research
                  </Link>
                  {confirmId === item.id ? (
                    <div className="flex items-center gap-1 rounded border px-2 py-1" style={{ background: "color-mix(in srgb, var(--neg) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--neg) 25%, transparent)" }}>
                      <AlertTriangle size={10} strokeWidth={1.5} style={{ color: "var(--neg)" }} />
                      <button onClick={() => delMut.mutate(item.id)} disabled={delMut.isPending}
                        className="text-xs font-semibold" style={{ color: "var(--neg)", background: "none", border: "none", cursor: "pointer" }}>
                        {delMut.isPending ? "…" : "Yes"}
                      </button>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <button onClick={() => setConfirmId(null)} className="text-xs" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(item.id)} disabled={delMut.isPending} aria-label="Remove"
                      className="flex h-7 w-7 items-center justify-center rounded border transition-colors duration-100"
                      style={{ color: "var(--text-faint)", border: "1px solid var(--border)", background: "transparent" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--neg)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--neg)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-faint)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
