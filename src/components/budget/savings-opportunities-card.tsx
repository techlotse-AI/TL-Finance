import type { SavingsOpportunity } from "@/lib/budget/analysis";
import { formatWhole } from "@/lib/money/rounding";
import { Card } from "@/components/ui/card";

export function SavingsOpportunitiesCard({ opportunities, currency }: { opportunities: SavingsOpportunity[]; currency: string }) {
  if (opportunities.length === 0) return null;
  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">Savings opportunities</h3>
      <div className="space-y-2">
        {opportunities.map((opportunity) => (
          <div className="flex items-center justify-between gap-3 rounded border p-3 text-sm" key={opportunity.category}>
            <span>
              <span className="font-medium">{opportunity.category}</span>{" "}
              <span className="text-subdued">· {opportunity.group} · {opportunity.percentOfIncome}% of income</span>
            </span>
            <span className="tabular-nums whitespace-nowrap text-status-success">
              save ~{formatWhole(opportunity.suggestedMonthlySaving, currency)}/mo
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
