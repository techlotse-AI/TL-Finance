import { AlertTriangle, ArrowLeftRight, CheckCircle2 } from "lucide-react";

import { AdherenceCrossLinkCard } from "@/components/budget/adherence-cross-link-card";
import { BudgetInsightsSummaryCard } from "@/components/budget/budget-insights-summary-card";
import { BudgetSubNav } from "@/components/budget-sub-nav";
import { MoneyFlowGraph } from "@/components/charts/money-flow-graph";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
import { buildPersistedMoneyFlow } from "@/lib/budget/persisted-plan";
import { prisma } from "@/lib/db/prisma";
import { formatWhole, RECONCILIATION_TOLERANCE } from "@/lib/money/rounding";

export const dynamic = "force-dynamic";

export default async function MonthlyPlanPage() {
  const context = await requirePageContext();
  const demoPlan = await buildPersistedMoneyFlow(prisma, context.householdId);
  const summary = [
    ["Normalized income", demoPlan.totals.income],
    ["Expenses (incl. provisions)", demoPlan.totals.expenses],
    ["Saving, investment, retirement", demoPlan.totals.contributions],
    ["Internal transfers", demoPlan.totals.transfers],
    ["Unallocated", demoPlan.totals.unallocated],
    ["One-time income", demoPlan.totals.oneTimeIncome],
    ["One-time planned uses", demoPlan.totals.oneTimeUses],
  ];

  return (
    <div className="mx-auto max-w-app space-y-6">
      <BudgetSubNav />
      <PageHeader
        description="Review normalized recurring income, internal account routes, and planned allocations. Internal transfers are shown but not counted as spending."
        title="Planned monthly flow"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Plan totals">
        {summary.map(([label, value], index) => (
          <Card className="p-4" key={label}>
            <p className="text-xs font-medium uppercase tracking-wide text-subdued">{label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {formatWhole(value, demoPlan.reportingCurrency)}
            </p>
            {index === 3 ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-brand-teal">
                <ArrowLeftRight className="size-3" /> Excluded from spending
              </p>
            ) : null}
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Money-flow graph</h2>
            <p className="mt-1 text-sm text-subdued">
              Reporting currency: {demoPlan.reportingCurrency}
            </p>
          </div>
          <Badge tone={demoPlan.warnings.length === 0 && demoPlan.reconciled ? "success" : "warning"}>
            {demoPlan.warnings.length === 0 && demoPlan.reconciled ? (
              <CheckCircle2 className="mr-1 size-3" />
            ) : (
              <AlertTriangle className="mr-1 size-3" />
            )}
            {demoPlan.warnings.length === 0 && demoPlan.reconciled
              ? `Reconciled (±${RECONCILIATION_TOLERANCE} tolerance)`
              : `${demoPlan.warnings.length} reconciliation warning${demoPlan.warnings.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        <div className="p-4">
          <MoneyFlowGraph
            accountTotals={demoPlan.accountTotals}
            links={demoPlan.links}
            nodes={demoPlan.nodes}
            reportingCurrency={demoPlan.reportingCurrency}
          />
        </div>
      </Card>

      {demoPlan.warnings.length > 0 ? (
        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Reconciliation warnings</h2>
            <p className="mt-1 text-xs text-subdued">Amounts within ±{RECONCILIATION_TOLERANCE} of zero are rounding noise, not shown here.</p>
          </div>
          <ul className="divide-y">
            {demoPlan.warnings.map((warning) => (
              <li className="flex gap-3 px-5 py-4 text-sm" key={`${warning.code}:${warning.resourceId}`}>
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-status-warning"
                />
                <div>
                  <p>{warning.message}</p>
                  <p className="mt-1 text-xs text-subdued">
                    {formatWhole(warning.amount, demoPlan.reportingCurrency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <BudgetInsightsSummaryCard householdId={context.householdId} />
      <AdherenceCrossLinkCard tier={context.tier} />
    </div>
  );
}
