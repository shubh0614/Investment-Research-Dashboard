export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      {/* Hero skeleton */}
      <div className="mb-8 rounded-2xl border p-7" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="skeleton mb-3 h-3 w-24 rounded" />
        <div className="skeleton mb-2 h-8 w-64 rounded-lg" />
        <div className="skeleton mb-4 h-4 w-48 rounded" />
        <div className="skeleton h-9 w-36 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reports skeleton */}
        <div className="lg:col-span-2">
          <div className="skeleton mb-3 h-4 w-28 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-2 rounded-xl border p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="skeleton mb-2 h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>

        {/* Watchlist skeleton */}
        <div>
          <div className="skeleton mb-3 h-4 w-20 rounded" />
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div className="skeleton h-4 w-12 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
