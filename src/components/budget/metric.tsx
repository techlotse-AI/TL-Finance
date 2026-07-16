import type { ReactNode } from "react";

export function Metric({ label, value, badge, note }: { label: string; value: ReactNode; badge?: ReactNode; note?: string }) {
  return (
    <div className="rounded border bg-muted/30 p-3">
      <p className="flex items-center justify-between text-xs text-subdued">{label}{badge}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-subdued">{note}</p> : null}
    </div>
  );
}
