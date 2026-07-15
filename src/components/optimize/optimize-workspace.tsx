"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScenarioCalculator } from "@/components/optimize/scenario-calculator";
import { WealthPlannerPanel } from "@/components/optimize/wealth-planner-panel";

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";
const TABS = [
  "Scenarios",
  "Wealth planner",
  "Emergency fund",
  "Pillar 3a",
  "Holdings",
  "Forecast",
  "Pensions",
  "Retirement",
  "Debt",
  "Net worth",
  "Goals",
  "Advisor",
] as const;
type Tab = (typeof TABS)[number];

function fmt(amount: string | number | undefined, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount ?? 0;
  try {
    return new Intl.NumberFormat("en-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

async function getJson(url: string): Promise<{ ok: boolean; data: any }> {
  const response = await fetch(url);
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm text-subdued">{label}{children}</label>;
}

export function OptimizeWorkspace({ currency }: { currency: string }) {
  const [tab, setTab] = useState<Tab>("Scenarios");
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b pb-2" aria-label="Optimize sections">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            aria-current={tab === name}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${tab === name ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white" : "bg-muted text-subdued hover:text-foreground"}`}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "Scenarios" ? <ScenarioCalculator currency={currency} /> : null}
      {tab === "Wealth planner" ? <WealthPlannerPanel currency={currency} /> : null}
      {tab === "Emergency fund" ? <EmergencyFundPanel currency={currency} /> : null}
      {tab === "Pillar 3a" ? <Pillar3aPanel currency={currency} /> : null}
      {tab === "Holdings" ? <HoldingsPanel currency={currency} /> : null}
      {tab === "Forecast" ? <ForecastPanel currency={currency} /> : null}
      {tab === "Pensions" ? <PensionsPanel currency={currency} /> : null}
      {tab === "Retirement" ? <RetirementPanel currency={currency} /> : null}
      {tab === "Debt" ? <DebtPanel currency={currency} /> : null}
      {tab === "Net worth" ? <NetWorthPanel currency={currency} /> : null}
      {tab === "Goals" ? <GoalsPanel currency={currency} /> : null}
      {tab === "Advisor" ? <AdvisorPanel currency={currency} /> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "funded" || status === "on_track" ? "success" : status === "partial" || status === "at_risk" ? "warning" : "danger";
  return <Badge tone={tone as any}>{status.replace(/_/g, " ")}</Badge>;
}

function EmergencyFundPanel({ currency }: { currency: string }) {
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [useProtection, setUseProtection] = useState(false);
  const [higherRate, setHigherRate] = useState(false);

  async function calculate(form: FormData) {
    setMessage(null);
    const body: any = {
      currentReserve: String(form.get("reserve") ?? "0"),
      targetMonths: Number(form.get("months") ?? 6),
    };
    if (useProtection) {
      body.swissUnemployment = {
        monthlyGrossSalary: String(form.get("salary") ?? "0"),
        higherRate,
        noticePeriodMonths: Number(form.get("notice") ?? 3),
        waitingPeriodMonths: Number(form.get("wait") ?? 2),
        benefitDurationMonths: Number(form.get("duration") ?? 24),
      };
    }
    const { ok, data } = await postJson("/api/optimize/emergency-fund", body);
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Emergency fund</h2>
        <form action={calculate} className="grid gap-3">
          <Field label={`Current liquid reserve (${currency})`}><input className={inputClass} name="reserve" inputMode="decimal" defaultValue="0" required /></Field>
          <Field label="Target months of runway"><input className={inputClass} name="months" type="number" min={1} max={24} defaultValue={6} /></Field>
          <label className="flex items-center gap-2 text-sm text-subdued"><input type="checkbox" checked={useProtection} onChange={(event) => setUseProtection(event.target.checked)} /> Account for Swiss unemployment insurance (ALV)</label>
          {useProtection ? (
            <div className="grid gap-3 rounded border bg-muted/30 p-3">
              <Field label={`Gross monthly salary (${currency})`}><input className={inputClass} name="salary" inputMode="decimal" defaultValue="8000" /></Field>
              <label className="flex items-center gap-2 text-sm text-subdued"><input type="checkbox" checked={higherRate} onChange={(event) => setHigherRate(event.target.checked)} /> 80% rate (children, age 55+, or low salary)</label>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Notice mo"><input className={inputClass} name="notice" type="number" min={0} max={24} defaultValue={3} /></Field>
                <Field label="Wait mo"><input className={inputClass} name="wait" type="number" min={0} max={24} defaultValue={2} /></Field>
                <Field label="Benefit mo"><input className={inputClass} name="duration" type="number" min={0} max={120} defaultValue={24} /></Field>
              </div>
              <p className="text-xs text-subdued">Insured salary is capped at CHF 12,350/month. The benefit is 70% (or 80%) of that, paid after the wait, once notice/severance ends.</p>
            </div>
          ) : null}
          <Button type="submit">Calculate</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3"><h3 className="font-semibold">Result</h3><StatusBadge status={result.status} />{result.incomeProtectionApplied ? <Badge tone={"locked" as any}>income-protected</Badge> : null}</div>
          {Number(result.essentialMonthly) === 0 ? (
            <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No essential budget items in {currency}. Mark required spending as Essential in Budget to size your fund.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Essential / month" value={fmt(result.essentialMonthly, currency)} />
            <Metric label={`Target (${result.targetMonths} mo)`} value={fmt(result.targetAmount, currency)} />
            <Metric label="Months covered" value={result.monthsCovered ?? "—"} />
            <Metric label="Funded" value={result.fundedPercent != null ? `${result.fundedPercent}%` : "—"} />
            <Metric label="Gap" value={fmt(result.gap, currency)} tone={Number(result.gap) > 0 ? "danger" : "success"} />
            <Metric label="Suggested / month" value={fmt(result.suggestedMonthlyContribution, currency)} />
          </div>
          {result.incomeProtectionApplied ? (
            <div className="space-y-2 rounded border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-subdued">Income protection</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Un-insured target" value={fmt(result.unInsuredTargetAmount, currency)} />
                <Metric label="Reduced by protection" value={fmt(result.protectionReduction, currency)} tone="success" />
              </div>
              <p className="text-xs text-subdued">{result.protectionExplanation}</p>
            </div>
          ) : null}
        </Card>
      ) : <Placeholder text="Enter your reserve to size an emergency fund from your essential spending." />}
    </div>
  );
}

function Pillar3aPanel({ currency }: { currency: string }) {
  const [hasPension, setHasPension] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function calculate(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/pillar-3a", {
      hasPensionFund: hasPension,
      netAnnualIncome: hasPension ? undefined : String(form.get("income") ?? "0"),
      contributedThisYear: String(form.get("contributed") ?? "0"),
      currentBalance: String(form.get("balance") ?? "0"),
      marginalTaxRate: String(form.get("rate") ?? "0.25"),
      yearsToRetirement: Number(form.get("years") ?? 25),
      annualReturnRate: String(form.get("return") ?? "0.03"),
    });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Pillar 3a</h2>
        <form action={calculate} className="grid gap-3">
          <label className="flex items-center gap-2 text-sm text-subdued"><input type="checkbox" checked={hasPension} onChange={(event) => setHasPension(event.target.checked)} /> I have a 2nd-pillar pension fund</label>
          {!hasPension ? <Field label={`Net annual income (${currency})`}><input className={inputClass} name="income" inputMode="decimal" defaultValue="0" /></Field> : null}
          <Field label={`Contributed this year (${currency})`}><input className={inputClass} name="contributed" inputMode="decimal" defaultValue="0" /></Field>
          <Field label={`Current 3a balance (${currency})`}><input className={inputClass} name="balance" inputMode="decimal" defaultValue="0" /></Field>
          <Field label="Marginal tax rate (0.25 = 25%)"><input className={inputClass} name="rate" inputMode="decimal" defaultValue="0.25" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Years to retirement"><input className={inputClass} name="years" type="number" min={1} max={50} defaultValue={25} /></Field>
            <Field label="Annual return (0.03)"><input className={inputClass} name="return" inputMode="decimal" defaultValue="0.03" /></Field>
          </div>
          <Button type="submit">Calculate</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3"><h3 className="font-semibold">{result.year} Pillar 3a</h3><Badge tone="locked">{result.basis === "with_pension_fund" ? "with pension fund" : "self-employed"}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Annual maximum" value={fmt(result.maxContribution, currency)} />
            <Metric label="Remaining this year" value={fmt(result.remainingThisYear, currency)} tone={Number(result.remainingThisYear) > 0 ? "warning" : "success"} />
            <Metric label="Tax saved at max / year" value={fmt(result.annualTaxSavingAtMax, currency)} />
            <Metric label="Tax saved on remaining" value={fmt(result.remainingTaxSaving, currency)} />
          </div>
          <div className="rounded border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-subdued">Projection · {result.projection.years} years · max each year</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Metric label="Ending balance" value={fmt(result.projection.endingBalance, currency)} />
              <Metric label="Of which growth" value={fmt(result.projection.totalGrowth, currency)} />
              <Metric label="Lifetime tax saved" value={fmt(result.projection.totalTaxSaved, currency)} />
            </div>
          </div>
        </Card>
      ) : <Placeholder text="The 2026 maximum is CHF 7,258 with a pension fund, or 20% of income up to CHF 36,288 without." />}
    </div>
  );
}

function HoldingsPanel({ currency }: { currency: string }) {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setMessage(null);
    const { ok, data } = await getJson("/api/optimize/holdings");
    if (!ok) { setMessage(data?.error?.message ?? "Could not load holdings."); return; }
    setPortfolio(data);
  }

  async function addHolding(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/holdings", {
      name: String(form.get("name") ?? ""),
      symbol: String(form.get("symbol") ?? "") || undefined,
      assetClass: String(form.get("assetClass") ?? "ETF"),
      currency: String(form.get("hcurrency") ?? currency).toUpperCase(),
      unitPrice: String(form.get("unitPrice") ?? "0"),
      lots: [{
        quantity: String(form.get("quantity") ?? "0"),
        unitCost: String(form.get("unitCost") ?? "0"),
        acquiredAt: String(form.get("acquiredAt") ?? new Date().toISOString().slice(0, 10)),
      }],
    });
    if (!ok) { setMessage(data?.error?.message ?? "Could not add holding."); return; }
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Holdings</h2><Button type="button" onClick={load}>Refresh</Button></div>
        <form action={addHolding} className="grid gap-3">
          <Field label="Name"><input className={inputClass} name="name" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol"><input className={inputClass} name="symbol" placeholder="CSPX" /></Field>
            <Field label="Asset class">
              <select className={inputClass} name="assetClass" defaultValue="ETF">
                {["EQUITY", "BOND", "FUND", "ETF", "CASH", "CRYPTO", "OTHER"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency"><input className={inputClass} name="hcurrency" defaultValue={currency} maxLength={3} /></Field>
            <Field label="Unit price"><input className={inputClass} name="unitPrice" inputMode="decimal" defaultValue="0" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input className={inputClass} name="quantity" inputMode="decimal" defaultValue="0" /></Field>
            <Field label="Unit cost"><input className={inputClass} name="unitCost" inputMode="decimal" defaultValue="0" /></Field>
          </div>
          <Field label="Acquired"><input className={inputClass} name="acquiredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          <Button type="submit">Add holding</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {portfolio ? (
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Portfolio ({portfolio.reportingCurrency})</h3>
          {portfolio.missingRateCurrencies?.length ? (
            <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No reporting rate for: {portfolio.missingRateCurrencies.join(", ")}. Those positions are excluded from totals.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Market value" value={fmt(portfolio.totalMarketValue, portfolio.reportingCurrency)} />
            <Metric label="Cost basis" value={fmt(portfolio.totalCostBasis, portfolio.reportingCurrency)} />
            <Metric label="Unrealized gain" value={fmt(portfolio.totalUnrealizedGain, portfolio.reportingCurrency)} tone={Number(portfolio.totalUnrealizedGain) >= 0 ? "success" : "danger"} />
          </div>
          {portfolio.positions?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-subdued"><th className="py-1">Holding</th><th>Class</th><th className="text-right">Qty</th><th className="text-right">Value</th><th className="text-right">Gain %</th></tr></thead>
                <tbody>
                  {portfolio.positions.map((position: any) => (
                    <tr key={position.id ?? position.name} className="border-t">
                      <td className="py-1">{position.name}</td>
                      <td>{position.assetClass}</td>
                      <td className="text-right tabular-nums">{Number(position.quantity)}</td>
                      <td className="text-right tabular-nums">{fmt(position.marketValue, position.currency)}</td>
                      <td className="text-right tabular-nums">{position.unrealizedGainPercent ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-subdued">No holdings yet.</p>}
        </Card>
      ) : <Placeholder text="Refresh to load your positions, or add a holding. Values convert to your base currency using stored reporting rates." />}
    </div>
  );
}

function ForecastPanel({ currency }: { currency: string }) {
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function calculate(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/forecast", {
      startingBalance: String(form.get("start") ?? "0"),
      monthlyNetFlow: String(form.get("flow") ?? "0"),
      months: Number(form.get("months") ?? 12),
      minimumBalance: String(form.get("min") ?? "0"),
    });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Balance forecast</h2>
        <form action={calculate} className="grid gap-3">
          <Field label={`Starting balance (${currency})`}><input className={inputClass} name="start" inputMode="decimal" defaultValue="0" /></Field>
          <Field label={`Monthly net flow (${currency}, may be negative)`}><input className={inputClass} name="flow" inputMode="decimal" defaultValue="0" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Months"><input className={inputClass} name="months" type="number" min={1} max={120} defaultValue={12} /></Field>
            <Field label={`Minimum balance (${currency})`}><input className={inputClass} name="min" inputMode="decimal" defaultValue="0" /></Field>
          </div>
          <Button type="submit">Project</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3"><h3 className="font-semibold">Forecast</h3>{result.shortfallMonth != null ? <Badge tone={"danger" as any}>shortfall month {result.shortfallMonth}</Badge> : <Badge tone={"success" as any}>no shortfall</Badge>}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Ending balance" value={fmt(result.endingBalance, currency)} tone={Number(result.endingBalance) >= 0 ? "success" : "danger"} />
            <Metric label="Lowest balance" value={fmt(result.lowestBalance, currency)} tone={Number(result.lowestBalance) >= 0 ? undefined : "danger"} />
            <Metric label="Lowest at month" value={result.lowestBalanceMonth} />
          </div>
          <p className="text-xs text-subdued">Interest-free projection of planned net flow. Optimize never changes your budget.</p>
        </Card>
      ) : <Placeholder text="Project a cash balance forward from a starting balance and your planned monthly net flow." />}
    </div>
  );
}

function PensionsPanel({ currency }: { currency: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [ahv, setAhv] = useState<any>(null);
  const [married, setMarried] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSummary() {
    setMessage(null);
    const { ok, data } = await getJson("/api/optimize/pensions");
    if (!ok) { setMessage(data?.error?.message ?? "Could not load pensions."); return; }
    setSummary(data);
  }

  async function addVehicle(form: FormData) {
    setMessage(null);
    const projCapital = String(form.get("projCapital") ?? "").trim();
    const projPension = String(form.get("projPension") ?? "").trim();
    const { ok, data } = await postJson("/api/optimize/pensions", {
      label: String(form.get("label") ?? ""),
      pillar: String(form.get("pillar") ?? "PILLAR_2"),
      currency: String(form.get("vcurrency") ?? currency).toUpperCase(),
      currentBalance: String(form.get("balance") ?? "0"),
      annualContribution: String(form.get("contribution") ?? "0"),
      annualReturnRate: String(form.get("return") ?? "0.02"),
      yearsToRetirement: Number(form.get("years") ?? 20),
      projectedCapitalOverride: projCapital && Number(projCapital) > 0 ? projCapital : undefined,
      projectedAnnualPensionOverride: projPension && Number(projPension) > 0 ? projPension : undefined,
    });
    if (!ok) { setMessage(data?.error?.message ?? "Could not add vehicle."); return; }
    await loadSummary();
  }

  async function calcAhv(form: FormData) {
    setMessage(null);
    const person = {
      determiningAverageAnnualIncome: String(form.get("income") ?? "0"),
      entryAge: Number(form.get("entryAge") ?? 21),
      referenceAge: Number(form.get("referenceAge") ?? 65),
    };
    const body: any = { person };
    if (married) {
      body.spouse = {
        determiningAverageAnnualIncome: String(form.get("sincome") ?? "0"),
        entryAge: Number(form.get("sentryAge") ?? 21),
        referenceAge: Number(form.get("sreferenceAge") ?? 65),
      };
    }
    const { ok, data } = await postJson("/api/optimize/ahv", body);
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setAhv(data);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Pension vehicles</h2><Button type="button" onClick={loadSummary}>Refresh</Button></div>
          <form action={addVehicle} className="grid gap-3">
            <Field label="Label"><input className={inputClass} name="label" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pillar"><select className={inputClass} name="pillar" defaultValue="PILLAR_2">{["PILLAR_2", "PILLAR_3A", "PILLAR_3B"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></Field>
              <Field label="Currency"><input className={inputClass} name="vcurrency" defaultValue={currency} maxLength={3} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current balance"><input className={inputClass} name="balance" inputMode="decimal" defaultValue="0" /></Field>
              <Field label="Annual contribution"><input className={inputClass} name="contribution" inputMode="decimal" defaultValue="0" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Annual return (0.02)"><input className={inputClass} name="return" inputMode="decimal" defaultValue="0.02" /></Field>
              <Field label="Years to retirement"><input className={inputClass} name="years" type="number" min={0} max={50} defaultValue={20} /></Field>
            </div>
            <fieldset className="grid gap-3 rounded border bg-muted/30 p-3">
              <legend className="px-1 text-xs font-semibold text-subdued">Provider projection (optional, Pillar 2 / BVG)</legend>
              <Field label={`Projected capital at retirement (${currency})`}><input className={inputClass} name="projCapital" inputMode="decimal" placeholder="From your BVG statement" /></Field>
              <Field label={`Projected annual pension (${currency})`}><input className={inputClass} name="projPension" inputMode="decimal" placeholder="Optional" /></Field>
              <p className="text-xs text-subdued">If set, the projected capital replaces the computed projection for this vehicle.</p>
            </fieldset>
            <Button type="submit">Add vehicle</Button>
          </form>
          {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
        </Card>
        {summary ? (
          <Card className="space-y-4 p-5">
            <h3 className="font-semibold">Projected capital at retirement</h3>
            <Metric label="Total capital" value={fmt(summary.totalCapitalAtRetirement, summary.currency)} />
            <div className="grid gap-3 sm:grid-cols-3">
              {summary.capitalByPillar?.map((entry: any) => <Metric key={entry.pillar} label={entry.pillar.replace("_", " ")} value={fmt(entry.endingBalance, summary.currency)} />)}
            </div>
            {Number(summary.totalProviderAnnualPension) > 0 ? (
              <Metric label="Provider annual pension (total)" value={fmt(summary.totalProviderAnnualPension, summary.currency)} />
            ) : null}
            {summary.projections?.some((projection: any) => projection.projectionSource === "provider") ? (
              <p className="text-xs text-subdued">Vehicles using a provider-stated projection are marked “provider”; others are computed from balance, contribution, and return.</p>
            ) : null}
            {summary.excludedCurrencyVehicles ? <p className="text-sm text-status-warning">{summary.excludedCurrencyVehicles} vehicle(s) in another currency are excluded from the total.</p> : null}
          </Card>
        ) : <Placeholder text="Add Pillar 2/3a/3b vehicles, then refresh to project capital at retirement." />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Pillar 1 (AHV) pension</h2>
          <form action={calcAhv} className="grid gap-3">
            <Field label="Determining avg annual income (CHF)"><input className={inputClass} name="income" inputMode="decimal" defaultValue="90720" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entry age (late entry)"><input className={inputClass} name="entryAge" type="number" min={15} max={70} defaultValue={21} /></Field>
              <Field label="Reference age"><input className={inputClass} name="referenceAge" type="number" min={58} max={70} defaultValue={65} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-subdued"><input type="checkbox" checked={married} onChange={(event) => setMarried(event.target.checked)} /> Married couple (apply 150% cap)</label>
            {married ? (
              <div className="grid gap-3 rounded border bg-muted/30 p-3">
                <Field label="Spouse income (CHF)"><input className={inputClass} name="sincome" inputMode="decimal" defaultValue="60000" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Spouse entry age"><input className={inputClass} name="sentryAge" type="number" min={15} max={70} defaultValue={21} /></Field>
                  <Field label="Spouse reference age"><input className={inputClass} name="sreferenceAge" type="number" min={58} max={70} defaultValue={65} /></Field>
                </div>
              </div>
            ) : null}
            <Button type="submit">Calculate AHV</Button>
          </form>
        </Card>
        {ahv ? (
          <Card className="space-y-4 p-5">
            <h3 className="font-semibold">{ahv.kind === "couple" ? "Couple AHV" : "Individual AHV"} ({ahv.year ?? ahv.spouseA?.year})</h3>
            {ahv.kind === "couple" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Spouse A monthly" value={fmt(ahv.spouseA.monthlyPension, currency)} />
                <Metric label="Spouse B monthly" value={fmt(ahv.spouseB.monthlyPension, currency)} />
                <Metric label="Combined before cap" value={fmt(ahv.combinedMonthlyBeforeCap, currency)} />
                <Metric label="Cap (150% max single)" value={fmt(ahv.monthlyCap, currency)} />
                <Metric label="Combined after cap" value={fmt(ahv.combinedMonthlyAfterCap, currency)} tone={ahv.capApplied ? "warning" : "success"} />
                <Metric label="Annual incl. 13th" value={fmt(ahv.combinedAnnualWithThirteenth, currency)} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Scale" value={ahv.scale} />
                <Metric label="Monthly pension" value={fmt(ahv.monthlyPension, currency)} />
                <Metric label="Missing years" value={ahv.missingYears} tone={ahv.missingYears > 0 ? "warning" : "success"} />
                <Metric label="Of full pension" value={`${ahv.partialFactorPercent}%`} />
                <Metric label="Annual pension" value={fmt(ahv.annualPension, currency)} />
                <Metric label="Annual incl. 13th" value={fmt(ahv.annualPensionWithThirteenth, currency)} />
              </div>
            )}
            <p className="text-xs text-subdued">Scale 44 Rentenformel. Late entry reduces contribution years proportionally; married couples are capped at 150% of the maximum single pension.</p>
          </Card>
        ) : <Placeholder text="The 2026 maximum single pension is CHF 2,520/month at 44 years and CHF 90,720 average income; the couple total is capped at CHF 3,780/month." />}
      </div>
    </div>
  );
}

function RetirementPanel({ currency }: { currency: string }) {
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function calculate(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/retirement", {
      targetAnnualIncome: String(form.get("target") ?? "0"),
      ahvAnnualIncome: String(form.get("ahv") ?? "0"),
      pensionCapitalAtRetirement: String(form.get("pensionCapital") ?? "0"),
      investmentCapitalAtRetirement: String(form.get("investCapital") ?? "0"),
      pensionAnnuitizationRate: String(form.get("annuitization") ?? "0.05"),
      investmentDrawdownRate: String(form.get("drawdown") ?? "0.04"),
      yearsInRetirement: Number(form.get("yearsIn") ?? 25),
      yearsToRetirement: Number(form.get("yearsTo") ?? 20),
      preRetirementReturnRate: String(form.get("return") ?? "0.03"),
    });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Retirement readiness</h2>
        <form action={calculate} className="grid gap-3">
          <Field label={`Target annual income (${currency})`}><input className={inputClass} name="target" inputMode="decimal" defaultValue="80000" /></Field>
          <Field label={`AHV annual income (${currency})`}><input className={inputClass} name="ahv" inputMode="decimal" defaultValue="30240" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pension capital"><input className={inputClass} name="pensionCapital" inputMode="decimal" defaultValue="0" /></Field>
            <Field label="Investment capital"><input className={inputClass} name="investCapital" inputMode="decimal" defaultValue="0" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annuitization (0.05)"><input className={inputClass} name="annuitization" inputMode="decimal" defaultValue="0.05" /></Field>
            <Field label="Drawdown (0.04)"><input className={inputClass} name="drawdown" inputMode="decimal" defaultValue="0.04" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Years to"><input className={inputClass} name="yearsTo" type="number" min={0} max={50} defaultValue={20} /></Field>
            <Field label="Years in"><input className={inputClass} name="yearsIn" type="number" min={1} max={50} defaultValue={25} /></Field>
            <Field label="Return"><input className={inputClass} name="return" inputMode="decimal" defaultValue="0.03" /></Field>
          </div>
          <Button type="submit">Assess</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3"><h3 className="font-semibold">Readiness</h3><StatusBadge status={result.status} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Projected income" value={fmt(result.projectedAnnualIncome, currency)} />
            <Metric label="Target income" value={fmt(result.targetAnnualIncome, currency)} />
            <Metric label="AHV" value={fmt(result.ahvAnnualIncome, currency)} />
            <Metric label="Pension income" value={fmt(result.pensionAnnualIncome, currency)} />
            <Metric label="Investment income" value={fmt(result.investmentAnnualIncome, currency)} />
            <Metric label="Coverage" value={result.coveragePercent != null ? `${result.coveragePercent}%` : "—"} />
            <Metric label="Annual gap" value={fmt(result.annualGap, currency)} tone={Number(result.annualGap) > 0 ? "danger" : "success"} />
            <Metric label="Required / month" value={fmt(result.requiredMonthlySaving, currency)} />
          </div>
          <p className="text-xs text-subdued">Deterministic, inflation-ignored. Combines AHV income, annuitized pension capital, and a sustainable investment drawdown.</p>
        </Card>
      ) : <Placeholder text="Combine AHV, pension capital, and investments into a readiness view with the monthly saving needed to close any gap." />}
    </div>
  );
}

function AdvisorPanel({ currency }: { currency: string }) {
  const [hasPension, setHasPension] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function calculate(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/recommendations", {
      currentReserve: String(form.get("reserve") ?? "0"),
      targetMonths: Number(form.get("months") ?? 6),
      hasPensionFund: hasPension,
      netAnnualIncome: hasPension ? undefined : String(form.get("income") ?? "0"),
      contributedThisYear: String(form.get("contributed") ?? "0"),
      marginalTaxRate: String(form.get("rate") ?? "0.25"),
    });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Advisor</h2>
        <p className="mb-3 text-sm text-subdued">Combines your emergency-fund gap, Pillar 3a headroom, and Analyze findings into ranked, explainable actions. Nothing is applied automatically.</p>
        <form action={calculate} className="grid gap-3 sm:grid-cols-3">
          <Field label={`Liquid reserve (${currency})`}><input className={inputClass} name="reserve" inputMode="decimal" defaultValue="0" /></Field>
          <Field label="Target months"><input className={inputClass} name="months" type="number" min={1} max={24} defaultValue={6} /></Field>
          <Field label="Marginal tax rate"><input className={inputClass} name="rate" inputMode="decimal" defaultValue="0.25" /></Field>
          <label className="flex items-center gap-2 text-sm text-subdued sm:col-span-3"><input type="checkbox" checked={hasPension} onChange={(event) => setHasPension(event.target.checked)} /> I have a 2nd-pillar pension fund</label>
          {!hasPension ? <Field label={`Net annual income (${currency})`}><input className={inputClass} name="income" inputMode="decimal" defaultValue="0" /></Field> : null}
          <Field label={`3a contributed this year (${currency})`}><input className={inputClass} name="contributed" inputMode="decimal" defaultValue="0" /></Field>
          <div className="flex items-end"><Button type="submit">Get recommendations</Button></div>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        result.recommendations.length === 0 ? (
          <Placeholder text="No actions right now — emergency fund, Pillar 3a, and spending all look on track." />
        ) : (
          <div className="space-y-3">
            {result.recommendations.map((rec: any, index: number) => (
              <Card key={index} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <h3 className="font-medium">{rec.title}</h3>
                  <p className="mt-1 text-sm text-subdued">{rec.detail}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rec.basis.map((basis: string) => <span key={basis} className="rounded bg-muted px-2 py-0.5 text-xs text-subdued">{basis}</span>)}
                  </div>
                </div>
                {rec.impactAmount ? <span className="text-sm font-semibold tabular-nums text-brand-teal">{fmt(rec.impactAmount, rec.currency ?? currency)}</span> : null}
              </Card>
            ))}
          </div>
        )
      ) : <Placeholder text="Fill in a few inputs to get ranked next actions." />}
    </div>
  );
}

function DebtPanel({ currency }: { currency: string }) {
  const [debts, setDebts] = useState<Array<{ name: string; balance: string; rate: string; min: string }>>([
    { name: "Credit card", balance: "5000", rate: "0.199", min: "150" },
    { name: "Car loan", balance: "12000", rate: "0.049", min: "300" },
  ]);
  const [extra, setExtra] = useState("200");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, key: "name" | "balance" | "rate" | "min", value: string) {
    setDebts((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  function addDebt() {
    setDebts((rows) => [...rows, { name: "", balance: "0", rate: "0.1", min: "0" }]);
  }
  function removeDebt(index: number) {
    setDebts((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  async function compare() {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/debt", {
      currency,
      extraMonthlyPayment: extra || "0",
      debts: debts.map((debt) => ({
        name: debt.name || "Debt",
        balance: debt.balance || "0",
        annualInterestRate: debt.rate || "0",
        minimumPayment: debt.min || "0",
      })),
    });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Debt payoff</h2><Button type="button" onClick={addDebt}>Add debt</Button></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-subdued"><th className="py-1">Name</th><th className="text-right">Balance</th><th className="text-right">APR</th><th className="text-right">Min / mo</th><th /></tr></thead>
            <tbody>
              {debts.map((debt, index) => (
                <tr key={index} className="border-t">
                  <td className="py-1 pr-2"><input className={inputClass} value={debt.name} onChange={(event) => update(index, "name", event.target.value)} aria-label="Debt name" /></td>
                  <td className="pr-2"><input className={`${inputClass} text-right`} value={debt.balance} inputMode="decimal" onChange={(event) => update(index, "balance", event.target.value)} aria-label="Balance" /></td>
                  <td className="pr-2"><input className={`${inputClass} text-right`} value={debt.rate} inputMode="decimal" onChange={(event) => update(index, "rate", event.target.value)} aria-label="Annual rate" /></td>
                  <td className="pr-2"><input className={`${inputClass} text-right`} value={debt.min} inputMode="decimal" onChange={(event) => update(index, "min", event.target.value)} aria-label="Minimum payment" /></td>
                  <td><button type="button" onClick={() => removeDebt(index)} className="rounded px-2 py-1 text-xs text-subdued hover:text-status-danger" aria-label="Remove debt">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={`Extra monthly payment (${currency})`}><input className={inputClass} value={extra} inputMode="decimal" onChange={(event) => setExtra(event.target.value)} /></Field>
          <Button type="button" onClick={compare}>Compare strategies</Button>
        </div>
        <p className="mt-2 text-xs text-subdued">APR as a decimal (0.199 = 19.9%). Interest is nominal APR compounded monthly. The total monthly budget (all minimums + extra) is held constant and rolls into the focus debt.</p>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <div className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <StrategyCard title="Avalanche (highest rate first)" plan={result.avalanche} currency={currency} recommended={result.recommendedStrategy === "avalanche"} />
            <StrategyCard title="Snowball (smallest balance first)" plan={result.snowball} currency={currency} recommended={result.recommendedStrategy === "snowball"} />
          </div>
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Avalanche vs snowball</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Interest saved by avalanche" value={fmt(result.interestSavedByAvalanche, currency)} tone={Number(result.interestSavedByAvalanche) > 0 ? "success" : undefined} />
              <Metric label="Months saved by avalanche" value={result.monthsSavedByAvalanche ?? "—"} />
              <Metric label="Recommended" value={result.recommendedStrategy} />
            </div>
            {result.avalanche.notes?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-status-warning">
                {result.avalanche.notes.map((note: string, index: number) => <li key={index}>{note}</li>)}
              </ul>
            ) : null}
          </Card>
        </div>
      ) : <Placeholder text="Add your debts and compare avalanche (cheapest) against snowball (fastest first wins)." />}
    </div>
  );
}

function StrategyCard({ title, plan, currency, recommended }: { title: string; plan: any; currency: string; recommended: boolean }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{title}</h3>
        {recommended ? <Badge tone={"success" as any}>recommended</Badge> : null}
        {plan.amortizes ? null : <Badge tone={"danger" as any}>does not clear</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Time to debt-free" value={plan.months != null ? `${plan.months} mo` : "—"} />
        <Metric label="Debt-free date" value={plan.payoffDate ?? "—"} />
        <Metric label="Total interest" value={fmt(plan.totalInterest, currency)} tone="danger" />
        <Metric label="Total paid" value={fmt(plan.totalPaid, currency)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-subdued"><th className="py-1">#</th><th>Debt</th><th className="text-right">Cleared mo</th><th className="text-right">Interest</th></tr></thead>
          <tbody>
            {plan.debts.map((debt: any) => (
              <tr key={debt.name} className="border-t">
                <td className="py-1">{debt.order}</td>
                <td>{debt.name}</td>
                <td className="text-right tabular-nums">{debt.payoffMonth ?? "—"}</td>
                <td className="text-right tabular-nums">{fmt(debt.interestPaid, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NetWorthPanel({ currency }: { currency: string }) {
  const [debts, setDebts] = useState<Array<{ name: string; balance: string; currency: string }>>([
    { name: "Mortgage", balance: "0", currency },
  ]);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, key: "name" | "balance" | "currency", value: string) {
    setDebts((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  function addDebt() {
    setDebts((rows) => [...rows, { name: "", balance: "0", currency }]);
  }
  function removeDebt(index: number) {
    setDebts((rows) => rows.filter((_, i) => i !== index));
  }

  async function compute() {
    setMessage(null);
    const payload = debts
      .filter((debt) => Number(debt.balance) > 0)
      .map((debt) => ({ name: debt.name || "Debt", balance: debt.balance || "0", currency: (debt.currency || currency).toUpperCase() }));
    const { ok, data } = await postJson("/api/optimize/net-worth", { debts: payload });
    if (!ok) { setMessage(data?.error?.message ?? "Calculation failed."); return; }
    setResult(data);
  }

  const categoryLabels: Record<string, string> = {
    cash: "Cash", investments: "Investments", pension: "Pension",
    other_asset: "Other assets", debt: "Debt", other_liability: "Other liabilities",
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Net worth</h2><Button type="button" onClick={addDebt}>Add debt</Button></div>
        <p className="mb-4 text-sm text-subdued">Combines your account balances, holdings, and pension balances as assets, minus the debts below. Add any liabilities, then compute. Optimize-only — never shown in Budget.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-subdued"><th className="py-1">Liability</th><th className="text-right">Balance</th><th>Currency</th><th /></tr></thead>
            <tbody>
              {debts.map((debt, index) => (
                <tr key={index} className="border-t">
                  <td className="py-1 pr-2"><input className={inputClass} value={debt.name} onChange={(event) => update(index, "name", event.target.value)} aria-label="Liability name" /></td>
                  <td className="pr-2"><input className={`${inputClass} text-right`} value={debt.balance} inputMode="decimal" onChange={(event) => update(index, "balance", event.target.value)} aria-label="Balance" /></td>
                  <td className="pr-2"><input className={inputClass} value={debt.currency} maxLength={3} onChange={(event) => update(index, "currency", event.target.value)} aria-label="Currency" /></td>
                  <td><button type="button" onClick={() => removeDebt(index)} className="rounded px-2 py-1 text-xs text-subdued hover:text-status-danger" aria-label="Remove liability">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4"><Button type="button" onClick={compute}>Compute net worth</Button></div>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h3 className="font-semibold">Statement ({result.reportingCurrency})</h3>
            {result.missingRateCurrencies?.length ? (
              <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No reporting rate for: {result.missingRateCurrencies.join(", ")}. Those lines are excluded from totals.</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Total assets" value={fmt(result.totalAssets, result.reportingCurrency)} tone="success" />
              <Metric label="Total liabilities" value={fmt(result.totalLiabilities, result.reportingCurrency)} tone="danger" />
              <Metric label="Net worth" value={fmt(result.netWorth, result.reportingCurrency)} tone={Number(result.netWorth) >= 0 ? "success" : "danger"} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.byCategory.map((entry: any) => (
                <Metric key={`${entry.category}-${entry.isLiability}`} label={`${categoryLabels[entry.category] ?? entry.category}${entry.isLiability ? " (liability)" : ""}`} value={`${fmt(entry.reportingValue, result.reportingCurrency)} · ${entry.percentOfSide}%`} />
              ))}
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Reconciliation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-subdued"><th className="py-1">Line</th><th>Category</th><th className="text-right">Amount</th><th className="text-right">In {result.reportingCurrency}</th></tr></thead>
                <tbody>
                  {result.lines.map((line: any, index: number) => (
                    <tr key={index} className="border-t">
                      <td className="py-1">{line.label}</td>
                      <td>{categoryLabels[line.category] ?? line.category}{line.isLiability ? " −" : ""}</td>
                      <td className="text-right tabular-nums">{fmt(line.amount, line.currency)}</td>
                      <td className="text-right tabular-nums">{line.included ? fmt(line.reportingValue, result.reportingCurrency) : "excluded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subdued">Cash from latest imported balances; investments at market value; pensions at current balance. Point-in-time, deterministic, store-nothing.</p>
          </Card>
        </div>
      ) : <Placeholder text="Add your debts and compute a point-in-time net-worth statement from your accounts, holdings, and pensions." />}
    </div>
  );
}

function goalTone(status: string): "success" | "warning" | "danger" {
  if (status === "reached" || status === "ahead" || status === "on_track") return "success";
  if (status === "no_target_date") return "warning";
  return "danger";
}

function GoalsPanel({ currency }: { currency: string }) {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setMessage(null);
    const { ok, data: payload } = await getJson("/api/optimize/goals");
    if (!ok) { setMessage(payload?.error?.message ?? "Could not load goals."); return; }
    setData(payload);
  }

  async function addGoal(form: FormData) {
    setMessage(null);
    const targetDate = String(form.get("targetDate") ?? "");
    const planned = String(form.get("planned") ?? "");
    const { ok, data: payload } = await postJson("/api/optimize/goals", {
      name: String(form.get("name") ?? ""),
      currency: String(form.get("gcurrency") ?? currency).toUpperCase(),
      targetAmount: String(form.get("target") ?? "0"),
      currentAmount: String(form.get("current") ?? "0"),
      targetDate: targetDate ? targetDate : null,
      plannedMonthlyContribution: planned ? planned : null,
    });
    if (!ok) { setMessage(payload?.error?.message ?? "Could not add goal."); return; }
    await load();
  }

  async function deleteGoal(id: string) {
    setMessage(null);
    const response = await fetch(`/api/optimize/goals/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (!response.ok) { setMessage("Could not delete goal."); return; }
    await load();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Financial goals</h2><Button type="button" onClick={load}>Refresh</Button></div>
        <form action={addGoal} className="grid gap-3">
          <Field label="Goal name"><input className={inputClass} name="name" placeholder="House deposit" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Target (${currency})`}><input className={inputClass} name="target" inputMode="decimal" defaultValue="0" required /></Field>
            <Field label="Currency"><input className={inputClass} name="gcurrency" defaultValue={currency} maxLength={3} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Already saved"><input className={inputClass} name="current" inputMode="decimal" defaultValue="0" /></Field>
            <Field label="Planned monthly"><input className={inputClass} name="planned" inputMode="decimal" placeholder="optional" /></Field>
          </div>
          <Field label="Target date (optional)"><input className={inputClass} name="targetDate" type="date" min={today} /></Field>
          <Button type="submit">Add goal</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {data ? (
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Goals ({data.summary?.reportingCurrency ?? currency})</h3>
          {data.summary?.missingRateCurrencies?.length ? (
            <p className="rounded border bg-muted/30 p-3 text-sm text-status-warning">No reporting rate for: {data.summary.missingRateCurrencies.join(", ")}. Those goals are excluded from the totals below.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Total target" value={fmt(data.summary?.totalTarget, data.summary?.reportingCurrency ?? currency)} />
            <Metric label="Saved so far" value={fmt(data.summary?.totalSaved, data.summary?.reportingCurrency ?? currency)} />
            <Metric label="Required / month" value={fmt(data.summary?.totalRequiredMonthly, data.summary?.reportingCurrency ?? currency)} />
          </div>
          {data.goals?.length ? (
            <div className="space-y-3">
              {data.goals.map((goal: any) => (
                <div key={goal.id ?? goal.name} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{goal.name}</div>
                    <div className="flex items-center gap-2">
                      <Badge tone={goalTone(goal.status) as any}>{String(goal.status).replace(/_/g, " ")}</Badge>
                      {goal.id ? <Button type="button" onClick={() => deleteGoal(goal.id)}>Delete</Button> : null}
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full bg-gradient-to-r from-brand-violet to-brand-teal" style={{ width: `${Math.min(100, Number(goal.progressPercent) || 0)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-subdued sm:grid-cols-4">
                    <span>{Number(goal.progressPercent)}% saved</span>
                    <span>{fmt(goal.currentAmount, goal.currency)} / {fmt(goal.targetAmount, goal.currency)}</span>
                    <span>{goal.monthsRemaining != null ? `${goal.monthsRemaining} mo left` : "open-ended"}</span>
                    <span>{goal.requiredMonthlyContributionRounded != null ? `need ${fmt(goal.requiredMonthlyContributionRounded, goal.currency)}/mo` : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-subdued">No goals yet. Add one to start tracking.</p>}
        </Card>
      ) : <Placeholder text="Refresh to load your goals, or add one. Required monthly contributions are rounded up to the nearest 5; totals convert to your base currency using stored reporting rates." />}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | "success" | "warning" }) {
  const color = tone === "danger" ? "text-status-danger" : tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : "";
  return (
    <div className="rounded border bg-muted/30 p-3">
      <p className="text-xs text-subdued">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <Card className="flex items-center p-5"><p className="text-sm text-subdued">{text}</p></Card>;
}
