import type { SpendSlice } from "@/lib/budget/analysis";
import { formatWhole } from "@/lib/money/rounding";
import { Card } from "@/components/ui/card";

const BAR_COLORS = ["#7c3aed", "#0d9488", "#2563eb", "#db2777", "#d97706", "#059669", "#9333ea", "#0891b2"];

export function SpendByCategoryCard({ slices, currency }: { slices: SpendSlice[]; currency: string }) {
  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">Top spending categories</h3>
      {slices.length === 0 ? (
        <p className="text-sm text-subdued">No expense data yet.</p>
      ) : (
        <Bars currency={currency} slices={slices} />
      )}
    </Card>
  );
}

function Bars({ slices, currency }: { slices: SpendSlice[]; currency: string }) {
  const max = Math.max(...slices.map((slice) => slice.monthlyRounded), 1);
  return (
    <div className="space-y-2">
      {slices.map((slice, index) => (
        <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-sm" key={slice.label}>
          <span className="truncate text-subdued" title={slice.label}>{slice.label}</span>
          <span className="h-4 overflow-hidden rounded bg-muted">
            <span
              className="block h-full rounded"
              style={{ width: `${(slice.monthlyRounded / max) * 100}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
            />
          </span>
          <span className="tabular-nums whitespace-nowrap">
            {formatWhole(slice.monthlyRounded, currency)} <span className="text-subdued">({slice.percentOfExpense}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}
