"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function fmt(amount: string | number | undefined, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount ?? 0;
  try {
    return new Intl.NumberFormat("en-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

interface Slice {
  label: string;
  monthly: string;
  monthlyRounded: number;
  percentOfExpense: number;
}

interface Guideline {
  targetPercent: number;
  actualPercent: number;
  actualMonthly: string;
  varianceMonthly: string;
  status: "under" | "on_target" | "over";
}

interface Analysis {
  reportingCurrency: string;
  totalIncome: string;
  totalExpense: string;
  totalSavingAllocations: string;
  netMonthly: string;
  savingsRatePercent: number;
  essentialMonthly: string;
  discretionaryMonthly: string;
  essentialRatioPercent: number;
  topSpendCategories: Slice[];
  spendByGroup: Slice[];
  needsWantsSavings: { needs: Guideline; wants: Guideline; savings: Guideline };
  savingsOpportunities: Array<{
    category: string;
    group: string;
    monthly: string;
    percentOfIncome: number;
    suggestedMonthlySaving: number;
    note: string;
  }>;
  balancesToZero: boolean;
  insights: string[];
  excludedCurrencyLines?: string[];
}

const BAR_COLORS = ["#7c3aed", "#0d9488", "#2563eb", "#db2777", "#d97706", "#059669", "#9333ea", "#0891b2"];

function Bars({ slices, currency }: { slices: Slice[]; currency: string }) {
  if (!slices.length) return <p className="text-sm text-subdued">No expense data yet.</p>;
  const max = Math.max(...slices.map((s) => s.monthlyRounded), 1);
  return (
    <div className="space-y-2">
      {slices.map((slice, index) => (
        <div key={slice.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-subdued" title={slice.label}>{slice.label}</span>
          <span className="h-4 overflow-hidden rounded bg-muted">
            <span
              className="block h-full rounded"
              style={{ width: `${(slice.monthlyRounded / max) * 100}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
            />
          </span>
          <span className="tabular-nums whitespace-nowrap">{fmt(slice.monthlyRounded, currency)} <span className="text-subdued">({slice.percentOfExpense}%)</span></span>
        </div>
      ))}
    </div>
  );
}

function GuidelineRow({ name, g, currency }: { name: string; g: Guideline; currency: string }) {
  const tone = g.status === "over" ? "#db2777" : g.status === "on_target" ? "#0d9488" : "#2563eb";
  return (
    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 text-sm">
      <span className="text-subdued">{name} <span className="text-xs">(≤{g.targetPercent}%)</span></span>
      <span className="relative h-4 overflow-hidden rounded bg-muted">
        <span className="block h-full rounded" style={{ width: `${Math.min(100, g.actualPercent)}%`, backgroundColor: tone }} />
        <span className="absolute top-0 h-4 w-px bg-foreground/60" style={{ left: `${Math.min(100, g.targetPercent)}%` }} />
      </span>
      <span className="tabular-nums whitespace-nowrap">{g.actualPercent}% · {fmt(g.actualMonthly, currency)}</span>
    </div>
  );
}

export function BudgetAnalysisPanel() {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/budget/analysis");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not load budget analysis.");
        return;
      }
      setData(payload as Analysis);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Card className="p-5"><p className="text-sm text-subdued">Loading budget analysis…</p></Card>;
  if (error) return <Card className="p-5"><p className="text-sm text-status-warning">{error}</p></Card>;
  if (!data) return null;

  const currency = data.reportingCurrency;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget analysis</h2>
        <Button type="button" onClick={() => void load()}>Refresh</Button>
      </div>

      {data.excludedCurrencyLines?.length ? (
        <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No reporting rate for: {data.excludedCurrencyLines.join(", ")}. Lines in those currencies are excluded.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Monthly income" value={fmt(data.totalIncome, currency)} />
        <Metric label="Monthly expenses" value={fmt(data.totalExpense, currency)} />
        <Metric label="Savings rate" value={`${data.savingsRatePercent}%`} />
        <Metric
          label="Unallocated / month"
          value={fmt(data.netMonthly, currency)}
          badge={data.balancesToZero ? <Badge tone="success">balanced</Badge> : <Badge tone="warning">off by &gt; 5</Badge>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Top spending categories</h3>
          <Bars slices={data.topSpendCategories} currency={currency} />
        </Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">50 / 30 / 20 guideline</h3>
          <p className="text-xs text-subdued">Bars show your share of income; the tick marks the guideline target.</p>
          <div className="space-y-2">
            <GuidelineRow name="Needs" g={data.needsWantsSavings.needs} currency={currency} />
            <GuidelineRow name="Wants" g={data.needsWantsSavings.wants} currency={currency} />
            <GuidelineRow name="Savings" g={data.needsWantsSavings.savings} currency={currency} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Metric label="Essential spend" value={fmt(data.essentialMonthly, currency)} />
            <Metric label="Essential ratio" value={`${data.essentialRatioPercent}%`} />
          </div>
        </Card>
      </div>

      {data.savingsOpportunities.length ? (
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Savings opportunities</h3>
          <div className="space-y-2">
            {data.savingsOpportunities.map((o) => (
              <div key={o.category} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
                <span><span className="font-medium">{o.category}</span> <span className="text-subdued">· {o.group} · {o.percentOfIncome}% of income</span></span>
                <span className="tabular-nums whitespace-nowrap text-status-success">save ~{fmt(o.suggestedMonthlySaving, currency)}/mo</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {data.insights.length ? (
        <Card className="space-y-2 p-5">
          <h3 className="font-semibold">Insights</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-subdued">
            {data.insights.map((insight, index) => <li key={index}>{insight}</li>)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="rounded border bg-muted/30 p-3">
      <p className="flex items-center justify-between text-xs text-subdued">{label}{badge}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
