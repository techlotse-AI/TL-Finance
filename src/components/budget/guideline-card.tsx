import type { GuidelineComparison } from "@/lib/budget/analysis";
import { formatWhole } from "@/lib/money/rounding";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/budget/metric";

export function GuidelineCard({
  needsWantsSavings,
  essentialMonthly,
  essentialRatioPercent,
  currency,
}: {
  needsWantsSavings: { needs: GuidelineComparison; wants: GuidelineComparison; savings: GuidelineComparison };
  essentialMonthly: string;
  essentialRatioPercent: number;
  currency: string;
}) {
  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">50 / 30 / 20 guideline</h3>
      <p className="text-xs text-subdued">Bars show your share of income; the tick marks the guideline target.</p>
      <div className="space-y-2">
        <GuidelineRow currency={currency} g={needsWantsSavings.needs} name="Needs" />
        <GuidelineRow currency={currency} g={needsWantsSavings.wants} name="Wants" />
        <GuidelineRow currency={currency} g={needsWantsSavings.savings} name="Savings" />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Metric label="Essential spend" value={formatWhole(essentialMonthly, currency)} />
        <Metric label="Essential ratio" value={`${essentialRatioPercent}%`} />
      </div>
    </Card>
  );
}

function GuidelineRow({ name, g, currency }: { name: string; g: GuidelineComparison; currency: string }) {
  const tone = g.status === "over" ? "#db2777" : g.status === "on_target" ? "#0d9488" : "#2563eb";
  return (
    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 text-sm">
      <span className="text-subdued">{name} <span className="text-xs">(≤{g.targetPercent}%)</span></span>
      <span className="relative h-4 overflow-hidden rounded bg-muted">
        <span className="block h-full rounded" style={{ width: `${Math.min(100, g.actualPercent)}%`, backgroundColor: tone }} />
        <span className="absolute top-0 h-4 w-px bg-foreground/60" style={{ left: `${Math.min(100, g.targetPercent)}%` }} />
      </span>
      <span className="tabular-nums whitespace-nowrap">{g.actualPercent}% · {formatWhole(g.actualMonthly, currency)}</span>
    </div>
  );
}
