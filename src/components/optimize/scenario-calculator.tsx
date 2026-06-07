"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatMoney } from "@/lib/money/decimal";
import type { ProjectionComparisonResult } from "@/lib/optimize/projection";

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

export function ScenarioCalculator({ currency }: { currency: string }) {
  const [result, setResult] = useState<ProjectionComparisonResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function calculate(formData: FormData) {
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/optimize/projections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency,
        startingAmount: formData.get("startingAmount"),
        monthlyContribution: formData.get("monthlyContribution"),
        years: Number(formData.get("years")),
        scenarios: [
          { name: "Conservative", annualReturnRate: formData.get("conservativeRate") },
          { name: "Base", annualReturnRate: formData.get("baseRate") },
          { name: "Optimistic", annualReturnRate: formData.get("optimisticRate") },
        ],
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | ProjectionComparisonResult
      | { error: { message?: string } }
      | null;

    setPending(false);
    if (!response.ok || !body || "error" in body) {
      setResult(null);
      setMessage(body && "error" in body ? body.error.message ?? "Calculation failed." : "Calculation failed.");
      return;
    }

    setResult(body);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Scenario assumptions</h2>
            <p className="mt-1 text-sm text-subdued">
              Compare deterministic projections in {currency}. Inputs are calculated on demand and are not persisted.
            </p>
          </div>
          <Badge tone="warning">Projection, not a prediction</Badge>
        </div>
        <form action={calculate} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Starting amount (${currency})`} name="startingAmount" defaultValue="10000" />
            <Field label={`Monthly contribution (${currency})`} name="monthlyContribution" defaultValue="500" />
            <Field label="Horizon (years)" name="years" defaultValue="20" max="60" min="1" step="1" />
          </div>
          <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <legend className="px-2 text-sm font-semibold">Annual return assumptions</legend>
            <Field label="Conservative rate" name="conservativeRate" defaultValue="0.02" max="1" min="-0.999999" step="any" />
            <Field label="Base rate" name="baseRate" defaultValue="0.05" max="1" min="-0.999999" step="any" />
            <Field label="Optimistic rate" name="optimisticRate" defaultValue="0.08" max="1" min="-0.999999" step="any" />
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pending} type="submit">{pending ? "Calculating…" : "Compare scenarios"}</Button>
            <p className="text-xs text-subdued">Rates are decimal fractions: 0.05 means 5%.</p>
          </div>
        </form>
        {message ? <p className="mt-4 text-sm text-status-danger" role="alert">{message}</p> : null}
      </Card>

      {result ? (
        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Scenario comparison</h2>
            <p className="mt-1 text-sm text-subdued">
              Effective monthly compounding, contributions at month end, excluding taxes and fees.
            </p>
          </div>
          <DataTable
            caption="Projection scenario comparison"
            headers={["Scenario", "Annual return", "Contributions", "Growth", "Ending balance"]}
            rows={result.scenarios.map((scenario) => [
              scenario.name,
              `${formatPercent(scenario.annualReturnRate)}%`,
              <MoneyValue currency={result.currency} key={`${scenario.name}:contributions`} value={scenario.totalContributions} />,
              <MoneyValue currency={result.currency} key={`${scenario.name}:growth`} value={scenario.totalGrowth} />,
              <MoneyValue currency={result.currency} key={`${scenario.name}:balance`} value={scenario.endingBalance} />,
            ])}
          />
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  defaultValue,
  label,
  max,
  min,
  name,
  step = "0.01",
}: {
  defaultValue: string;
  label: string;
  max?: string;
  min?: string;
  name: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-subdued">
      {label}
      <input
        className={inputClass}
        defaultValue={defaultValue}
        max={max}
        min={min ?? "0"}
        name={name}
        required
        step={step}
        type="number"
      />
    </label>
  );
}

function MoneyValue({ currency, value }: { currency: string; value: string }) {
  return <span className="tabular-nums">{formatMoney(value, currency)}</span>;
}

function formatPercent(rate: string): string {
  return (Number(rate) * 100).toLocaleString("en-CH", { maximumFractionDigits: 2 });
}
