"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function QuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    router.push(`/research/new?q=${encodeURIComponent(v)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface-1)",
        overflow: "hidden",
        transition: "border-color 140ms",
      }}
      onFocusCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = "var(--accent)"; }}
      onBlurCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = "var(--border)"; }}
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ask a research question — e.g. Compare AMD and NVDA this quarter"
        style={{
          flex: 1,
          height: 44,
          padding: "0 16px",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 14,
          color: "var(--text)",
          fontFamily: "var(--font-sans)",
        }}
      />
      <button
        type="submit"
        disabled={!q.trim()}
        style={{
          height: 44,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--accent)",
          color: "var(--accent-ink)",
          border: "none",
          borderLeft: "1px solid var(--accent)",
          fontSize: 13,
          fontWeight: 600,
          cursor: q.trim() ? "pointer" : "not-allowed",
          opacity: q.trim() ? 1 : 0.45,
          transition: "opacity 140ms",
          flexShrink: 0,
        }}
      >
        Research
        <ArrowRight size={13} strokeWidth={2} />
      </button>
    </form>
  );
}
