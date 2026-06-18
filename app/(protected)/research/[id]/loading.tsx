export default function ReportLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      {/* Back + title */}
      <div className="skeleton mb-6 h-4 w-24 rounded" />
      <div className="skeleton mb-8 h-7 w-72 rounded-lg" />

      {/* Company card skeleton */}
      <div className="mb-6 rounded-xl border p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="skeleton mb-2 h-5 w-16 rounded" />
            <div className="skeleton h-4 w-40 rounded" />
          </div>
          <div className="skeleton h-6 w-20 rounded" />
        </div>
        <div className="skeleton mb-4 h-16 w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="skeleton mb-1 h-3 w-16 rounded" />
              <div className="skeleton h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="mb-6 rounded-xl border p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="skeleton mb-4 h-4 w-24 rounded" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>

      {/* News skeleton */}
      <div className="rounded-xl border p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="skeleton mb-4 h-4 w-20 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-4 pb-4" style={{ borderBottom: i < 2 ? "1px solid var(--border)" : undefined }}>
            <div className="skeleton mb-2 h-4 w-full rounded" />
            <div className="skeleton mb-1 h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
