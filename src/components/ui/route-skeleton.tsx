/** Generic loading placeholder for a Budget-tier route: a header bar plus a few pulsing rows. */
export function RouteSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto max-w-app space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="space-y-3 border-b pb-6">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted" />
      </div>
      <div className="overflow-hidden rounded-lg border">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex items-center gap-4 border-b p-4 last:border-b-0" key={index}>
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
