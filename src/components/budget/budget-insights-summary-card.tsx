import Link from "next/link";

import { Metric } from "@/components/budget/metric";
import { Card } from "@/components/ui/card";
import { loadBudgetAnalysis } from "@/lib/budget/analysis-loader";

/** Server-rendered taste of the full Budget analysis, linking through to /budget for detail. No client fetch. */
export async function BudgetInsightsSummaryCard({ householdId }: { householdId: string }) {
  const analysis = await loadBudgetAnalysis(householdId);
  const topInsight = analysis.insights[0];
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Budget analysis</h2>
        <Link className="text-sm font-medium text-brand-teal hover:underline" href="/budget">
          Full analysis →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Savings rate" value={`${analysis.savingsRatePercent}%`} />
        <Metric label="Essential ratio" value={`${analysis.essentialRatioPercent}%`} />
      </div>
      {topInsight ? <p className="text-sm text-subdued">{topInsight}</p> : null}
    </Card>
  );
}
