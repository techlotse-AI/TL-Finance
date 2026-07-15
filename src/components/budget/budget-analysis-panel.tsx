"use client";

import { useEffect, useState } from "react";

import { GuidelineCard } from "@/components/budget/guideline-card";
import { InsightsCard } from "@/components/budget/insights-card";
import { Metric } from "@/components/budget/metric";
import { SavingsOpportunitiesCard } from "@/components/budget/savings-opportunities-card";
import { SpendByCategoryCard } from "@/components/budget/spend-by-category-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BudgetAnalysisWithWarnings } from "@/lib/budget/analysis-loader";
import { formatWhole } from "@/lib/money/rounding";

export function BudgetAnalysisPanel() {
  const [data, setData] = useState<BudgetAnalysisWithWarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Pure fetcher: never touches React state, so it is safe to call anywhere.
  async function fetchAnalysis(): Promise<{ ok: true; data: BudgetAnalysisWithWarnings } | { ok: false; error: string }> {
    try {
      const response = await fetch("/api/budget/analysis");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: payload?.error?.message ?? "Could not load budget analysis." };
      }
      return { ok: true, data: payload as BudgetAnalysisWithWarnings };
    } catch {
      return { ok: false, error: "Could not load budget analysis." };
    }
  }

  // State updates happen only inside the resolution callback (the pattern the
  // react-hooks/set-state-in-effect rule endorses), never synchronously in the
  // effect body.
  useEffect(() => {
    let cancelled = false;
    void fetchAnalysis().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    const result = await fetchAnalysis();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  if (loading) return <Card className="p-5"><p className="text-sm text-subdued">Loading budget analysis…</p></Card>;
  if (error) return <Card className="p-5"><p className="text-sm text-status-warning">{error}</p></Card>;
  if (!data) return null;

  const currency = data.reportingCurrency;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget analysis</h2>
        <Button type="button" onClick={() => void refresh()}>Refresh</Button>
      </div>

      {data.excludedCurrencyLines.length ? (
        <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No reporting rate for: {data.excludedCurrencyLines.join(", ")}. Lines in those currencies are excluded.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Monthly income" value={formatWhole(data.totalIncome, currency)} />
        <Metric
          label="Monthly expenses"
          value={formatWhole(data.totalExpense, currency)}
          note={Number(data.provisionsMonthly) > 0 ? `incl. ${formatWhole(data.provisionsMonthly, currency)} provisions` : undefined}
        />
        <Metric label="Savings rate" value={`${data.savingsRatePercent}%`} />
        <Metric
          label="Unallocated / month"
          value={formatWhole(data.netMonthly, currency)}
          badge={data.balancesToZero ? <Badge tone="success">balanced</Badge> : <Badge tone="warning">off by &gt; 5</Badge>}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Saving / month" value={formatWhole(data.savingMonthly, currency)} />
        <Metric label="Investing / month" value={formatWhole(data.investingMonthly, currency)} />
        <Metric label="Retirement / month" value={formatWhole(data.retirementMonthly, currency)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendByCategoryCard currency={currency} slices={data.topSpendCategories} />
        <GuidelineCard
          currency={currency}
          essentialMonthly={data.essentialMonthly}
          essentialRatioPercent={data.essentialRatioPercent}
          needsWantsSavings={data.needsWantsSavings}
        />
      </div>

      <SavingsOpportunitiesCard currency={currency} opportunities={data.savingsOpportunities} />
      <InsightsCard insights={data.insights} />
    </div>
  );
}
