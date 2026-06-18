"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { ResearchReport } from "@/lib/ai/schemas";

const EXAMPLES = [
  "Give me an overview of NVIDIA: this quarter's stock performance, major news, and key risks.",
  "Compare AMD and Intel: market cap, revenue, P/E, and competitive positioning.",
  "What are the major risks for Microsoft going into the next quarter?",
  "Summarize recent news and sentiment around Apple — last 30 days only.",
];

type Phase =
  | { step: "idle" }
  | { step: "planning" }
  | { step: "running"; tools: string[] }
  | { step: "synthesizing" }
  | { step: "error"; message: string };

export default function NewResearchPage() {
  const router   = useRouter();
  const [query, setQuery]   = useState("");
  const [phase, setPhase]   = useState<Phase>({ step: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || phase.step !== "idle") return;

    setPhase({ step: "planning" });

    try {
      setPhase({ step: "running", tools: [] });

      const report = await apiFetch<ResearchReport>("/api/research", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      });

      setPhase({ step: "synthesizing" });

      // Persist the report, then navigate to it
      const saved = await apiFetch<{ id: string }>("/api/research/save", {
        method: "POST",
        body: JSON.stringify({
          query_text:  query.trim(),
          title:       query.trim().slice(0, 100),
          result_json: report,
          tags:        [],
        }),
      });

      router.push(`/research/${saved.id}`);
    } catch (err) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }

  const running = phase.step !== "idle" && phase.step !== "error";

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col px-8 py-12"
      style={{ color: "var(--text)" }}
    >
      {/* Header */}
      <div className="mb-10 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
        >
          <Sparkles size={22} strokeWidth={1.5} />
        </div>
        <h1
          className="text-3xl font-semibold"
          style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
        >
          Research anything
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Ask in plain English. The AI selects and runs the right tools, then synthesizes a sourced report.
        </p>
      </div>

      {/* Query form */}
      <form onSubmit={handleSubmit} className="reveal">
        <div
          className="overflow-hidden rounded-xl border transition-colors duration-150"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={running}
            placeholder="e.g. Give me an overview of NVIDIA: stock performance, major news, and key risks."
            rows={4}
            className="w-full resize-none bg-transparent px-5 pt-4 text-sm outline-none placeholder:opacity-50"
            style={{ color: "var(--text)", lineHeight: "1.6" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
            }}
          />
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              ⌘ + Enter to submit
            </span>
            <button
              type="submit"
              disabled={!query.trim() || running}
              className="flex h-8 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity duration-150 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              {running ? (
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Search size={13} strokeWidth={1.5} />
              )}
              {running ? "Researching…" : "Research"}
            </button>
          </div>
        </div>
      </form>

      {/* Phase indicator */}
      {running && (
        <div
          className="mt-4 flex items-center gap-3 rounded-lg px-4 py-3 reveal"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {phase.step === "planning"     && "Planning which tools to use…"}
              {phase.step === "running"      && "Fetching market data, news, and filings…"}
              {phase.step === "synthesizing" && "Synthesizing your report…"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              This usually takes 10–30 seconds
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {phase.step === "error" && (
        <div
          className="mt-4 rounded-lg px-4 py-3 reveal"
          style={{ background: "color-mix(in srgb, var(--negative) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--negative) 30%, transparent)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--negative)" }}>Research failed</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{phase.message}</p>
          <button
            onClick={() => setPhase({ step: "idle" })}
            className="mt-2 text-xs underline"
            style={{ color: "var(--accent)" }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Example prompts */}
      {phase.step === "idle" && (
        <div className="mt-8 stagger">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Example queries
          </p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="mb-2 flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-150"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
            >
              <ArrowRight size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
