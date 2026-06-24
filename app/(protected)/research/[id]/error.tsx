"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Report render error:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ color: "var(--text)" }}
    >
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text)", letterSpacing: "-0.015em", fontFamily: "var(--font-serif)" }}
        >
          Could not load report
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          The report data may be in an unexpected format. Try reloading or go back to history.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
            ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded border px-4 py-2 text-sm font-medium transition-colors duration-150"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--surface-1)" }}
        >
          Try again
        </button>
        <Link
          href="/history"
          className="rounded border px-4 py-2 text-sm font-medium transition-colors duration-150"
          style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
        >
          Back to history
        </Link>
      </div>
    </div>
  );
}
