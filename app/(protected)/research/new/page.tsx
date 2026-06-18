"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import type { ResearchReport } from "@/lib/ai/schemas";

const EXAMPLES = [
  "Give me an overview of NVIDIA: this quarter's stock performance, major news, and key risks.",
  "Compare AMD and Intel: market cap, revenue, P/E, and competitive positioning.",
  "What are the major risks for Microsoft going into the next quarter?",
  "Summarize recent news and sentiment around Apple — last 30 days only.",
];

const STEPS = [
  { key: "planning",     label: "Planning",      desc: "Selecting tools" },
  { key: "running",      label: "Fetching data",  desc: "Market data, news, filings" },
  { key: "synthesizing", label: "Synthesizing",   desc: "Building your report" },
] as const;

type Phase =
  | { step: "idle" }
  | { step: "planning" }
  | { step: "running" }
  | { step: "synthesizing" }
  | { step: "error"; message: string };

function StepProgress({ phase }: { phase: Phase }) {
  const stepIndex = { planning: 0, running: 1, synthesizing: 2 } as const;
  const current = phase.step !== "idle" && phase.step !== "error"
    ? stepIndex[phase.step as keyof typeof stepIndex] ?? -1
    : -1;

  return (
    <div style={{ padding: "20px 24px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {STEPS.map((step, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={step.key} style={{ display: "flex", flex: i < STEPS.length - 1 ? 1 : "none", alignItems: "flex-start" }}>
              {/* dot + label */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div
                  className={active ? "step-dot-active dot-pop" : done ? "dot-pop" : ""}
                  style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: done || active ? "var(--accent)" : "var(--surface-2)",
                    border: done || active ? "none" : "2px solid var(--border)",
                    transition: "background 400ms, border 400ms",
                  }}
                />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: done || active ? "var(--accent)" : "var(--text-muted)", transition: "color 300ms", whiteSpace: "nowrap" }}>
                    {step.label}
                  </p>
                  <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px", whiteSpace: "nowrap" }}>
                    {active ? step.desc : ""}
                  </p>
                </div>
              </div>

              {/* connector line */}
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, marginTop: 4, marginLeft: 8, marginRight: 8, background: "var(--border)", position: "relative", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    className={done ? "line-grow" : ""}
                    style={{
                      position: "absolute", inset: 0,
                      background: "var(--accent)",
                      transform: done ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      transition: done ? "none" : "transform 0ms",
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NewResearchPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const prefill      = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(prefill);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || phase.step !== "idle") return;

    setPhase({ step: "planning" });

    try {
      await new Promise((r) => setTimeout(r, 600)); // let planning step render
      setPhase({ step: "running" });

      const report = await apiFetch<ResearchReport>("/api/research", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      });

      setPhase({ step: "synthesizing" });

      const saved = await apiFetch<{ id: string }>("/api/research/save", {
        method: "POST",
        body: JSON.stringify({
          query_text:  query.trim(),
          title:       query.trim().slice(0, 100),
          result_json: report,
          tags:        [],
        }),
      });

      toast("Report saved", "success");
      router.push(`/research/${saved.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setPhase({ step: "error", message: msg });
      toast(msg, "error");
    }
  }

  const running = phase.step !== "idle" && phase.step !== "error";

  return (
    <div style={{ position: "relative", minHeight: "100%", color: "var(--text)" }}>
      {/* Grid background */}
      <div className="grid-bg grid-bg-mask" style={{ position: "absolute", inset: 0, opacity: 0.35, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", padding: "48px 32px 32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          {/* Icon with radar rings */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <div className="radar-ring" />
            <div className="radar-ring" />
            <div className="radar-ring" />
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 16, background: "var(--accent-weak)", color: "var(--accent)", boxShadow: "0 0 0 8px color-mix(in srgb, var(--accent) 6%, transparent), 0 0 24px color-mix(in srgb, var(--accent) 20%, transparent)" }}>
              <Sparkles size={22} strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="gradient-heading" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.2 }}>
            Research anything
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ask in plain English. The AI selects the right tools, fetches live data,<br />and synthesizes a sourced report.
          </p>
        </div>

        {/* Query form */}
        <form onSubmit={handleSubmit} className="reveal">
          <div className={running ? "ai-thinking-wrap" : ""} style={running ? { borderRadius: 15.5 } : {}}>
          <div style={{ borderRadius: running ? 14 : 14, border: running ? "none" : "1px solid var(--border)", background: "var(--surface)", overflow: "hidden", boxShadow: "0 4px 24px rgba(16,18,22,.1)" }}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={running}
              placeholder="e.g. Give me an overview of NVIDIA: stock performance, major news, and key risks."
              rows={4}
              style={{ width: "100%", padding: "18px 20px 12px", background: "transparent", resize: "none", outline: "none", fontSize: 14, color: "var(--text)", lineHeight: 1.65, fontFamily: "var(--font-sans)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
              }}
            />

            {/* Step progress — shown while running */}
            {running && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <StepProgress phase={phase} />
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 14px", borderTop: running ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ⌘+Enter to submit
              </span>
              <button
                type="submit"
                disabled={!query.trim() || running}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  height: 34, padding: "0 16px", borderRadius: 9,
                  background: "var(--accent)", color: "var(--bg)",
                  fontSize: 13, fontWeight: 600,
                  opacity: (!query.trim() || running) ? 0.4 : 1,
                  transition: "opacity 150ms",
                  border: "none", cursor: running ? "not-allowed" : "pointer",
                }}
              >
                <Sparkles size={13} strokeWidth={1.5} />
                {running ? "Researching…" : "Research"}
              </button>
            </div>
          </div>
          </div>
        </form>

        {/* Error state */}
        {phase.step === "error" && (
          <div className="reveal" style={{ marginTop: 12, borderRadius: 10, padding: "12px 16px", background: "color-mix(in srgb, var(--negative) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--negative) 25%, transparent)" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--negative)" }}>Research failed</p>
            <p style={{ marginTop: 3, fontSize: 12, color: "var(--text-muted)" }}>{phase.message}</p>
            <button onClick={() => setPhase({ step: "idle" })} style={{ marginTop: 6, fontSize: 12, color: "var(--accent)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
              Try again
            </button>
          </div>
        )}

        {/* Example prompts */}
        {phase.step === "idle" && (
          <div style={{ marginTop: 32 }} className="stagger">
            <p style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              Example queries
            </p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="example-prompt"
                style={{ display: "flex", width: "100%", alignItems: "flex-start", gap: 12, borderRadius: 10, padding: "11px 14px", marginBottom: 8, textAlign: "left", border: "none", cursor: "pointer" }}
              >
                <ArrowRight size={13} strokeWidth={1.5} style={{ color: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{ex}</span>
              </button>
            ))}
          </div>
        )}

        {/* Keyboard hint */}
        {phase.step === "idle" && (
          <p style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Pro tip: press <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)" }}>⌘K</kbd> from anywhere to jump to any page
          </p>
        )}
      </div>
    </div>
  );
}
