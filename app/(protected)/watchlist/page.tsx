"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Trash2, Loader2, Search, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import Link from "next/link";

interface WatchlistItem { id: string; ticker: string; company_name: string; created_at: string; }

export default function WatchlistPage() {
  const qc = useQueryClient();
  const [ticker, setTicker]     = useState("");
  const [company, setCompany]   = useState("");
  const [formErr, setFormErr]   = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => apiFetch<{ items: WatchlistItem[] }>("/api/watchlist"),
  });

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

  const items = data?.items ?? [];

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !company.trim()) return;
    setFormErr(null);
    addMut.mutate({ ticker: ticker.trim().toUpperCase(), company_name: company.trim() });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-10 page-enter" style={{ color: "var(--text)" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.018em" }}>Watchlist</h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>Track companies for quick research access</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="mb-6 rounded-xl border p-5 reveal card-lift"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="mb-3 text-sm font-medium">Add a ticker</p>
        <div className="flex gap-3">
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="NVDA" maxLength={10}
            className="h-9 w-24 rounded-lg border px-3 font-mono text-sm uppercase outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontVariantNumeric: "tabular-nums", transition: "border-color 140ms" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="NVIDIA Corporation"
            className="h-9 flex-1 rounded-lg border px-3 text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", transition: "border-color 140ms" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <button type="submit" disabled={addMut.isPending || !ticker.trim() || !company.trim()}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--bg)", border: "none", cursor: "pointer" }}>
            {addMut.isPending ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : <Plus size={13} strokeWidth={1.5} />}
            Add
          </button>
        </div>
        {formErr && <p className="mt-2 text-xs" style={{ color: "var(--negative)" }}>{formErr}</p>}
      </form>

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <Bookmark size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tickers yet</p>
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-hidden rounded-xl border stagger" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {items.map((item, i) => (
            <div key={item.id} className="row-hover" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <div className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-16 font-mono text-sm font-semibold" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                  {item.ticker}
                </span>
                <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{item.company_name}</span>
                <Link href={`/research/new?q=${encodeURIComponent(`Give me an overview of ${item.ticker}`)}`}
                  className="btn-outline flex h-7 items-center gap-1 px-2.5 text-xs">
                  <Search size={11} strokeWidth={1.5} />
                  Research
                </Link>
                {confirmId === item.id ? (
                  <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1 reveal" style={{ background: "color-mix(in srgb, var(--negative) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--negative) 25%, transparent)" }}>
                    <AlertTriangle size={11} strokeWidth={1.5} style={{ color: "var(--negative)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--negative)" }}>Remove?</span>
                    <button onClick={() => delMut.mutate(item.id)} disabled={delMut.isPending}
                      className="text-xs font-semibold" style={{ color: "var(--negative)", background: "none", border: "none", cursor: "pointer" }}>
                      {delMut.isPending ? "…" : "Yes"}
                    </button>
                    <span style={{ color: "var(--border)" }}>·</span>
                    <button onClick={() => setConfirmId(null)} className="text-xs" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(item.id)} disabled={delMut.isPending} aria-label="Remove"
                    className="btn-icon btn-icon-danger flex h-7 w-7 items-center justify-center">
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
