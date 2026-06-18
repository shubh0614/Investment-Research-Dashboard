"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Tag, Trash2, FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface ReportSummary {
  id:         string;
  title:      string;
  query_text: string;
  created_at: string;
  updated_at: string;
  tags:       string[];
}

interface ListResult {
  reports: ReportSummary[];
  total:   number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HistoryPage() {
  const qc = useQueryClient();
  const [q, setQ]       = useState("");
  const [tag, setTag]   = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [draftTag, setDraftTag] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", q, tag],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q)   params.set("q",   q);
      if (tag) params.set("tag", tag);
      params.set("limit", "50");
      return apiFetch<ListResult>(`/api/research?${params}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/research/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Delete failed");
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(draftQ);
    setTag(draftTag);
  }

  function clearFilters() {
    setQ(""); setTag(""); setDraftQ(""); setDraftTag("");
  }

  const reports = data?.reports ?? [];
  const total   = data?.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10" style={{ color: "var(--text)" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.018em" }}>
            History
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {isLoading ? "Loading…" : `${total} report${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/research/new"
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-opacity duration-150"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          <Search size={13} strokeWidth={1.5} />
          New research
        </Link>
      </div>

      {/* Search + filter */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={13} strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Search title or query…"
            className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition-colors duration-150"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>
        <div className="relative w-40">
          <Tag
            size={13} strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={draftTag}
            onChange={(e) => setDraftTag(e.target.value)}
            placeholder="Filter by tag"
            className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition-colors duration-150"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg px-4 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          Search
        </button>
        {(q || tag) && (
          <button
            type="button" onClick={clearFilters}
            className="h-9 rounded-lg border px-3 text-sm transition-colors duration-150"
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Clear
          </button>
        )}
      </form>

      {/* States */}
      {isLoading && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      )}

      {isError && (
        <div className="flex h-40 items-center justify-center rounded-xl border"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--negative)" }}>Failed to load reports.</p>
        </div>
      )}

      {!isLoading && !isError && reports.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <FileText size={24} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {q || tag ? "No reports match your filters." : "No saved reports yet."}
            </p>
            {!q && !tag && (
              <Link href="/research/new" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>
                Run your first research query →
              </Link>
            )}
          </div>
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {reports.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-4 px-5 py-4 table-row-hover"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/research/${r.id}`}
                  className="block text-sm font-medium hover:underline"
                  style={{ color: "var(--text)" }}
                >
                  {r.title || r.query_text}
                </Link>
                {r.title && (
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{r.query_text}</p>
                )}
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setDraftTag(t); setTag(t); }}
                        className="rounded px-1.5 py-0.5 font-mono text-xs transition-colors duration-150"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatDate(r.created_at)}
                </span>
                <button
                  onClick={() => {
                    if (confirm("Delete this report?")) deleteMut.mutate(r.id);
                  }}
                  disabled={deleteMut.isPending}
                  aria-label="Delete report"
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--negative) 12%, transparent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--negative)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
