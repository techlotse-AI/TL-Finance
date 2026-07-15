"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DrawdownChart,
  LeverComparisonChart,
  PayInsVsGrowthChart,
  WealthProjectionChart,
  percentLabel,
} from "@/components/charts/wealth-charts";
import type { DrawdownResult } from "@/lib/optimize/drawdown";
import type { WealthProjectionResult, WealthProjectionSeries } from "@/lib/optimize/wealth-projection";

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

interface ScheduleRow {
  a: string;
  b: string;
}

interface SavedPlan {
  id: string;
  name: string;
  currency: string;
  config: unknown;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm text-subdued">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border bg-muted/30 p-3">
      <p className="text-xs text-subdued">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function fmt(amount: string | number | undefined, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  try {
    return new Intl.NumberFormat("en-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const response = await fetch(url, init);
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

function parseRates(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAges(value: string): number[] {
  return parseRates(value).map(Number).filter(Number.isFinite);
}

/**
 * Editable two-column row list (Debt-panel idiom) for schedule parts: step
 * changes, annual lump sums, and one-time injections.
 */
function RowEditor({
  title,
  columnA,
  columnB,
  rows,
  onChange,
  hint,
}: {
  title: string;
  columnA: string;
  columnB: string;
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  hint: string;
}) {
  return (
    <div className="rounded border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          className="rounded bg-muted px-2 py-1 text-xs text-subdued hover:text-foreground"
          onClick={() => onChange([...rows, { a: "", b: "" }])}
        >
          Add row
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-subdued">{hint}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2" key={index}>
              <input
                className={`${inputClass} text-right`}
                inputMode="numeric"
                value={row.a}
                aria-label={`${title}: ${columnA}`}
                placeholder={columnA}
                onChange={(event) =>
                  onChange(rows.map((entry, i) => (i === index ? { ...entry, a: event.target.value } : entry)))
                }
              />
              <input
                className={`${inputClass} text-right`}
                inputMode="decimal"
                value={row.b}
                aria-label={`${title}: ${columnB}`}
                placeholder={columnB}
                onChange={(event) =>
                  onChange(rows.map((entry, i) => (i === index ? { ...entry, b: event.target.value } : entry)))
                }
              />
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-subdued hover:text-status-danger"
                aria-label={`Remove ${title} row`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WealthPlannerPanel({ currency }: { currency: string }) {
  // Shared plan configuration — one config drives both views.
  const [currentAge, setCurrentAge] = useState("43");
  const [targetAge, setTargetAge] = useState("65");
  const [initialBalance, setInitialBalance] = useState("185000");
  const [baseMonthly, setBaseMonthly] = useState("4200");
  const [projectionRates, setProjectionRates] = useState("0.04, 0.05, 0.07");
  const [steps, setSteps] = useState<ScheduleRow[]>([]);
  const [lumps, setLumps] = useState<ScheduleRow[]>([]);
  const [injections, setInjections] = useState<ScheduleRow[]>([]);
  const [levers, setLevers] = useState<Array<{ name: string; baseMonthly: string }>>([]);

  // Drawdown settings.
  const [startingCapital, setStartingCapital] = useState("");
  const [drawdownRates, setDrawdownRates] = useState("0.02, 0.03, 0.04, 0.05");
  const [depleteAges, setDepleteAges] = useState("85, 90, 95");
  const [monthlyExpense, setMonthlyExpense] = useState("");
  const [drawdownRateTab, setDrawdownRateTab] = useState(0);

  const [projection, setProjection] = useState<WealthProjectionResult | null>(null);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [drawdown, setDrawdown] = useState<DrawdownResult | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [planName, setPlanName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadPlans() {
    const { ok, data } = await requestJson("/api/optimize/wealth/plans");
    if (ok && Array.isArray(data)) setPlans(data);
  }

  function schedulePayload() {
    return {
      baseMonthly: baseMonthly || "0",
      steps: steps
        .filter((row) => row.a && row.b)
        .map((row) => ({ fromMonth: Number(row.a), monthlyAmount: row.b })),
      annualLumpSums: lumps
        .filter((row) => row.a && row.b)
        .map((row) => ({ monthOfYear: Number(row.a), amount: row.b })),
      oneTimeInjections: injections
        .filter((row) => row.a && row.b)
        .map((row) => ({ month: Number(row.a), amount: row.b })),
    };
  }

  function configPayload() {
    return {
      version: 1,
      currentAge: Number(currentAge),
      targetRetirementAge: Number(targetAge),
      initialBalance: initialBalance || "0",
      schedule: schedulePayload(),
      projectionRates: parseRates(projectionRates),
      drawdown: {
        annualReturnRates: parseRates(drawdownRates),
        depleteAtAges: parseAges(depleteAges),
        ...(monthlyExpense ? { monthlyExpense } : {}),
      },
    };
  }

  async function runProjection() {
    setMessage(null);
    const { ok, data } = await requestJson("/api/optimize/wealth/projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency,
        currentAge: Number(currentAge),
        targetAge: Number(targetAge),
        initialBalance: initialBalance || "0",
        schedule: schedulePayload(),
        annualReturnRates: parseRates(projectionRates),
        ...(levers.some((lever) => lever.name)
          ? {
              levers: levers
                .filter((lever) => lever.name)
                .map((lever) => ({
                  name: lever.name,
                  schedule: { ...schedulePayload(), baseMonthly: lever.baseMonthly || "0" },
                })),
            }
          : {}),
      }),
    });
    if (!ok) {
      setMessage(data?.error?.message ?? "Projection failed.");
      return;
    }
    const result = data as WealthProjectionResult;
    setProjection(result);
    const rates = [...new Set(result.series.map((series) => series.annualReturnRate))];
    setSelectedRate((current) => (current && rates.includes(current) ? current : rates[Math.floor(rates.length / 2)] ?? null));
  }

  async function runDrawdown() {
    setMessage(null);
    const { ok, data } = await requestJson("/api/optimize/wealth/drawdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency,
        startingCapital: startingCapital || "0",
        startAge: Number(targetAge),
        annualReturnRates: parseRates(drawdownRates),
        depleteAtAges: parseAges(depleteAges),
        ...(monthlyExpense ? { monthlyExpense } : {}),
      }),
    });
    if (!ok) {
      setMessage(data?.error?.message ?? "Drawdown calculation failed.");
      return;
    }
    setDrawdown(data as DrawdownResult);
    setDrawdownRateTab(0);
  }

  async function savePlan() {
    if (!planName.trim()) {
      setMessage("Give the plan a name before saving.");
      return;
    }
    setMessage(null);
    const existing = plans.find((plan) => plan.name.toLowerCase() === planName.trim().toLowerCase());
    const { ok, data } = await requestJson(
      existing ? `/api/optimize/wealth/plans/${existing.id}` : "/api/optimize/wealth/plans",
      {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: planName.trim(), currency, config: configPayload() }),
      },
    );
    if (!ok) {
      setMessage(data?.error?.message ?? "Saving the plan failed.");
      return;
    }
    setMessage(`Plan "${planName.trim()}" saved.`);
    await loadPlans();
  }

  function applyPlan(plan: SavedPlan) {
    const config = plan.config as ReturnType<typeof configPayload> | null;
    if (!config || config.version !== 1) {
      setMessage("This plan uses an unsupported configuration version.");
      return;
    }
    setPlanName(plan.name);
    setCurrentAge(String(config.currentAge));
    setTargetAge(String(config.targetRetirementAge));
    setInitialBalance(config.initialBalance);
    setBaseMonthly(config.schedule.baseMonthly);
    setSteps(config.schedule.steps.map((row) => ({ a: String(row.fromMonth), b: row.monthlyAmount })));
    setLumps(config.schedule.annualLumpSums.map((row) => ({ a: String(row.monthOfYear), b: row.amount })));
    setInjections(config.schedule.oneTimeInjections.map((row) => ({ a: String(row.month), b: row.amount })));
    setProjectionRates(config.projectionRates.join(", "));
    setDrawdownRates(config.drawdown.annualReturnRates.join(", "));
    setDepleteAges(config.drawdown.depleteAtAges.join(", "));
    setMonthlyExpense(config.drawdown.monthlyExpense ?? "");
    setMessage(`Plan "${plan.name}" loaded.`);
  }

  async function deletePlan(plan: SavedPlan) {
    const { ok, data } = await requestJson(`/api/optimize/wealth/plans/${plan.id}`, { method: "DELETE" });
    if (!ok) {
      setMessage(data?.error?.message ?? "Deleting the plan failed.");
      return;
    }
    await loadPlans();
  }

  const baselineSeries = projection?.series.filter((series) => series.name === "baseline") ?? [];
  const selectedBaseline =
    baselineSeries.find((series) => series.annualReturnRate === selectedRate) ?? baselineSeries[0] ?? null;
  const leverSeries: WealthProjectionSeries[] = selectedBaseline
    ? (projection?.series.filter((series) => series.annualReturnRate === selectedBaseline.annualReturnRate) ?? [])
    : [];
  const drawdownRate = drawdown?.byRate[drawdownRateTab] ?? null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-subdued">
        All values are in today&apos;s purchasing power: salaries and expenses are assumed to grow with
        inflation, so the return rates below are <strong>real</strong> returns. Calculations are
        deterministic and computed on demand; only the plan configuration is saved.
      </p>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Plan configuration</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current age">
                <input className={inputClass} inputMode="numeric" value={currentAge} onChange={(event) => setCurrentAge(event.target.value)} />
              </Field>
              <Field label="Retirement age">
                <input className={inputClass} inputMode="numeric" value={targetAge} onChange={(event) => setTargetAge(event.target.value)} />
              </Field>
            </div>
            <Field label={`Initial balance (${currency})`}>
              <input className={inputClass} inputMode="decimal" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} />
            </Field>
            <Field label={`Monthly contribution (${currency})`}>
              <input className={inputClass} inputMode="decimal" value={baseMonthly} onChange={(event) => setBaseMonthly(event.target.value)} />
            </Field>
            <Field label="Projection real return rates (decimals, comma-separated)">
              <input className={inputClass} value={projectionRates} onChange={(event) => setProjectionRates(event.target.value)} />
            </Field>
            <RowEditor
              title="Contribution steps"
              columnA="From month"
              columnB={`New monthly amount (${currency})`}
              rows={steps}
              onChange={setSteps}
              hint="Absolute replacements, e.g. from month 37 contribute 4875 when childcare ends."
            />
            <RowEditor
              title="Annual lump sums"
              columnA="Month of year (1–12)"
              columnB={`Amount (${currency})`}
              rows={lumps}
              onChange={setLumps}
              hint="Recurring yearly, e.g. bonuses in April and October."
            />
            <RowEditor
              title="One-time injections"
              columnA="Month"
              columnB={`Amount (${currency})`}
              rows={injections}
              onChange={setInjections}
              hint="Start-of-month one-offs, e.g. property sale proceeds at month 6."
            />
            <div className="rounded border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Levers (vs baseline)</p>
                <button
                  type="button"
                  className="rounded bg-muted px-2 py-1 text-xs text-subdued hover:text-foreground"
                  onClick={() => setLevers((rows) => [...rows, { name: "", baseMonthly }])}
                >
                  Add lever
                </button>
              </div>
              {levers.length === 0 ? (
                <p className="text-xs text-subdued">Optional scenarios with a different monthly contribution.</p>
              ) : (
                <div className="space-y-2">
                  {levers.map((lever, index) => (
                    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2" key={index}>
                      <input
                        className={inputClass}
                        value={lever.name}
                        placeholder="Lever name"
                        aria-label="Lever name"
                        onChange={(event) =>
                          setLevers((rows) => rows.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                        }
                      />
                      <input
                        className={`${inputClass} text-right`}
                        inputMode="decimal"
                        value={lever.baseMonthly}
                        aria-label="Lever monthly contribution"
                        onChange={(event) =>
                          setLevers((rows) => rows.map((row, i) => (i === index ? { ...row, baseMonthly: event.target.value } : row)))
                        }
                      />
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-subdued hover:text-status-danger"
                        aria-label="Remove lever"
                        onClick={() => setLevers((rows) => rows.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" onClick={runProjection}>
              Project wealth
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Drawdown settings</h2>
            <Field label={`Portfolio at retirement (${currency})`}>
              <div className="flex gap-2">
                <input className={inputClass} inputMode="decimal" value={startingCapital} onChange={(event) => setStartingCapital(event.target.value)} />
                {selectedBaseline ? (
                  <Button type="button" variant="secondary" onClick={() => setStartingCapital(String(Math.round(Number(selectedBaseline.endingBalance))))}>
                    Use projection
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field label="Drawdown real return rates (decimals, comma-separated)">
              <input className={inputClass} value={drawdownRates} onChange={(event) => setDrawdownRates(event.target.value)} />
            </Field>
            <Field label="Deplete-at ages (comma-separated)">
              <input className={inputClass} value={depleteAges} onChange={(event) => setDepleteAges(event.target.value)} />
            </Field>
            <Field label={`Fixed monthly expense, optional (${currency})`}>
              <input className={inputClass} inputMode="decimal" value={monthlyExpense} onChange={(event) => setMonthlyExpense(event.target.value)} placeholder="e.g. 10929" />
            </Field>
            <Button type="button" onClick={runDrawdown}>
              Plan drawdown
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Saved plans</h2>
              <button
                type="button"
                className="rounded bg-muted px-2 py-1 text-xs text-subdued hover:text-foreground"
                onClick={loadPlans}
              >
                Load plans
              </button>
            </div>
            <div className="flex gap-2">
              <input className={inputClass} value={planName} placeholder="Plan name" aria-label="Plan name" onChange={(event) => setPlanName(event.target.value)} />
              <Button type="button" variant="secondary" onClick={savePlan}>
                Save
              </Button>
            </div>
            {plans.length === 0 ? (
              <p className="text-xs text-subdued">No plans loaded. Saving stores the configuration, never results.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {plans.map((plan) => (
                  <li className="flex items-center justify-between gap-2" key={plan.id}>
                    <button type="button" className="truncate text-left hover:underline" onClick={() => applyPlan(plan)}>
                      {plan.name}
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-subdued hover:text-status-danger"
                      aria-label={`Delete plan ${plan.name}`}
                      onClick={() => deletePlan(plan)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {message ? <p className="text-sm text-status-warning">{message}</p> : null}
        </div>

        <div className="space-y-4">
          {projection && baselineSeries.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {baselineSeries.map((series) => (
                  <Metric
                    key={series.annualReturnRate}
                    label={`At ${percentLabel(series.annualReturnRate)} real (age ${projection.targetAge})`}
                    value={fmt(series.endingBalance, currency)}
                  />
                ))}
              </div>

              <Card className="space-y-3 p-5">
                <h3 className="font-semibold">Wealth over time</h3>
                <WealthProjectionChart series={baselineSeries} currency={currency} />
              </Card>

              {selectedBaseline ? (
                <Card className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Pay-ins vs internal growth</h3>
                    <label className="flex items-center gap-2 text-xs text-subdued">
                      Rate
                      <select
                        className="min-h-8 rounded border bg-muted px-2 text-sm text-foreground"
                        value={selectedBaseline.annualReturnRate}
                        onChange={(event) => setSelectedRate(event.target.value)}
                      >
                        {baselineSeries.map((series) => (
                          <option key={series.annualReturnRate} value={series.annualReturnRate}>
                            {percentLabel(series.annualReturnRate)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <PayInsVsGrowthChart series={selectedBaseline} currency={currency} />
                  {leverSeries.length > 1 ? (
                    <>
                      <h3 className="pt-2 font-semibold">Lever comparison</h3>
                      <LeverComparisonChart series={leverSeries} currency={currency} />
                    </>
                  ) : null}
                  <DataTable
                    caption={`Yearly projection at ${percentLabel(selectedBaseline.annualReturnRate)} real return`}
                    headers={["Age", "Cumulative pay-ins", "Internal growth", "Portfolio value"]}
                    rows={selectedBaseline.points.map((point) => [
                      point.age,
                      fmt(point.cumulativePayIns, currency),
                      fmt(point.growth, currency),
                      fmt(point.endingBalance, currency),
                    ])}
                  />
                </Card>
              ) : null}
            </>
          ) : (
            <Card className="flex items-center p-5">
              <p className="text-sm text-subdued">Configure the plan and run the projection to see wealth charts.</p>
            </Card>
          )}

          {drawdown && drawdownRate ? (
            <Card className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Drawdown from age {drawdown.startAge}</h3>
                <div className="flex gap-1" role="tablist" aria-label="Drawdown return rate">
                  {drawdown.byRate.map((rate, index) => (
                    <button
                      key={rate.annualReturnRate}
                      type="button"
                      role="tab"
                      aria-selected={index === drawdownRateTab}
                      className={`rounded px-2 py-1 text-xs font-medium ${index === drawdownRateTab ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white" : "bg-muted text-subdued hover:text-foreground"}`}
                      onClick={() => setDrawdownRateTab(index)}
                    >
                      {percentLabel(rate.annualReturnRate)}
                    </button>
                  ))}
                </div>
              </div>
              <DrawdownChart rate={drawdownRate} currency={currency} />
              {drawdownRate.fixedExpense ? (
                <p className="text-sm text-subdued">
                  Drawing {fmt(drawdownRate.fixedExpense.monthlyExpense, currency)}/mo:{" "}
                  {drawdownRate.fixedExpense.sustainable
                    ? "the capital is never depleted (the draw is covered by growth)."
                    : drawdownRate.fixedExpense.depletionAge! > drawdown.assumptions.foreverDisplayCapAge
                      ? `effectively forever (depletes beyond age ${drawdown.assumptions.foreverDisplayCapAge}).`
                      : `the capital lasts to about age ${drawdownRate.fixedExpense.depletionAge!.toFixed(1)}.`}
                </p>
              ) : null}
              <DataTable
                caption="Monthly draw by real return rate and horizon"
                headers={[
                  "Real return",
                  ...(drawdown.byRate[0]?.depleteBy.map((entry) => `Zero at ${entry.targetAge}`) ?? []),
                  "Endowment (never)",
                ]}
                rows={drawdown.byRate.map((rate) => [
                  percentLabel(rate.annualReturnRate),
                  ...rate.depleteBy.map((entry) => `${fmt(entry.monthlyDraw, currency)}/mo`),
                  `${fmt(rate.endowmentMonthlyDraw, currency)}/mo`,
                ])}
              />
            </Card>
          ) : (
            <Card className="flex items-center p-5">
              <p className="text-sm text-subdued">Set the retirement portfolio and run the drawdown planner.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
