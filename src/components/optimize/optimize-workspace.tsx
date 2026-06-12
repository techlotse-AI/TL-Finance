"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScenarioCalculator } from "@/components/optimize/scenario-calculator";

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";
const TABS = ["Scenarios", "Emergency fund", "Pillar 3a", "Advisor"] as const;
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
      {tab === "Emergency fund" ? <EmergencyFundPanel currency={currency} /> : null}
      {tab === "Pillar 3a" ? <Pillar3aPanel currency={currency} /> : null}
      {tab === "Advisor" ? <AdvisorPanel currency={currency} /> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "funded" ? "success" : status === "partial" ? "warning" : "danger";
  return <Badge tone={tone as any}>{status}</Badge>;
}

function EmergencyFundPanel({ currency }: { currency: string }) {
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function calculate(form: FormData) {
    setMessage(null);
    const { ok, data } = await postJson("/api/optimize/emergency-fund", {
      currentReserve: String(form.get("reserve") ?? "0"),
      targetMonths: Number(form.get("months") ?? 6),
    });
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
          <Button type="submit">Calculate</Button>
        </form>
        {message ? <p className="mt-3 text-sm text-status-warning">{message}</p> : null}
      </Card>
      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3"><h3 className="font-semibold">Result</h3><StatusBadge status={result.status} /></div>
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
