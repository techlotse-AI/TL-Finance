"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Pocket { id: string; name: string; currency: string; accountName: string }
interface Category { id: string; name: string; kind: string }
interface BudgetItem { id: string; name: string; categoryId: string; currency: string }
interface ParserInfo { key: string; institution: string; label: string; templateHint: string }

interface Props {
  pockets: Pocket[];
  categories: Category[];
  budgetItems: BudgetItem[];
  parsers: ParserInfo[];
  initialStatus: { imports: number; transactions: number; review: number };
}

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";
const TABS = ["Import", "Review", "Transfers", "Adherence", "Findings"] as const;
type Tab = (typeof TABS)[number];

function fmt(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat("en-CH", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

async function patchJson(url: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AnalysisWorkspace(props: Props) {
  const [tab, setTab] = useState<Tab>("Import");
  const [status, setStatus] = useState(props.initialStatus);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/analysis/status");
    if (!response.ok) return;
    const data = await response.json();
    setStatus({ imports: data.imports, transactions: data.transactions, review: data.review });
  }, []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Statement imports" value={status.imports} />
        <StatCard label="Actual transactions" value={status.transactions} />
        <StatCard label="Awaiting review" value={status.review} tone={status.review > 0 ? "warning" : "neutral"} />
      </section>

      <nav className="flex flex-wrap gap-2 border-b pb-2" aria-label="Analyze sections">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              tab === name ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white" : "bg-muted text-subdued hover:text-foreground"
            }`}
            aria-current={tab === name}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === "Import" ? <ImportPanel {...props} onChanged={refreshStatus} /> : null}
      {tab === "Review" ? <ReviewPanel {...props} onChanged={refreshStatus} /> : null}
      {tab === "Transfers" ? <TransfersPanel onChanged={refreshStatus} /> : null}
      {tab === "Adherence" ? <AdherencePanel /> : null}
      {tab === "Findings" ? <FindingsPanel /> : null}
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-subdued">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === "warning" ? "text-status-warning" : ""}`}>{value}</p>
    </Card>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-subdued" role="status">{children}</p> : null;
}

/* ----------------------------------- Import ---------------------------------- */

function ImportPanel({ pockets, parsers, onChanged }: Props & { onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pocketId, setPocketId] = useState(pockets[0]?.id ?? "");
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runPreview() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setPreview(null);
    const contentBase64 = await fileToBase64(file);
    const { ok, data } = await postJson("/api/analysis/imports/preview", { filename: file.name, contentBase64 });
    setBusy(false);
    if (!ok) {
      setMessage(data?.error?.message ?? "Could not preview this statement.");
      return;
    }
    setPreview(data.preview);
    if (data.accountSuggestion?.accountPocketId) {
      setPocketId(data.accountSuggestion.accountPocketId);
      setMessage(`Suggested ${data.accountSuggestion.accountName} · ${data.accountSuggestion.currency} from statement reference ${data.accountSuggestion.maskedReference}.`);
    } else if (data.accountSuggestion) {
      setMessage(`Matched ${data.accountSuggestion.accountName} from the statement reference. Select the correct currency route.`);
    }
  }

  async function runCommit() {
    if (!file || !pocketId) return;
    setBusy(true);
    setMessage(null);
    const contentBase64 = await fileToBase64(file);
    const { ok, data } = await postJson("/api/analysis/imports/commit", { filename: file.name, contentBase64, accountPocketId: pocketId });
    setBusy(false);
    if (!ok) {
      setMessage(data?.error?.message ?? "Commit failed.");
      return;
    }
    setMessage(`Imported ${data.importedCount} transactions (${data.duplicateCount} duplicates skipped).`);
    setPreview(null);
    setFile(null);
    onChanged();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Import a statement</h2>
        <input
          type="file"
          accept=".csv,text/csv"
          className={inputClass}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setMessage(null); }}
        />
        <label className="grid gap-2 text-sm text-subdued">
          Account this statement belongs to
          <select className={inputClass} value={pocketId} onChange={(event) => setPocketId(event.target.value)}>
            {pockets.length === 0 ? <option value="">Create an account first</option> : null}
            {pockets.map((pocket) => (
              <option key={pocket.id} value={pocket.id}>{pocket.accountName} · {pocket.currency}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!file || busy} onClick={runPreview}>{busy ? "Working…" : "Preview"}</Button>
          <Button disabled={!file || !pocketId || busy || !preview} onClick={runCommit}>Commit import</Button>
        </div>
        <Notice>{message}</Notice>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Supported formats</h2>
        <ul className="space-y-2 text-sm text-subdued">
          {parsers.map((parser) => (
            <li key={parser.key} className="rounded border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{parser.label}</span>
                <Badge tone="success">{parser.institution}</Badge>
              </div>
              <p className="mt-1 text-xs">{parser.templateHint}</p>
            </li>
          ))}
        </ul>
      </Card>

      {preview ? (
        <Card className="space-y-3 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Preview</h2>
            <Badge tone="neutral">{preview.parserKey}</Badge>
            <Badge tone={preview.warnings.length > 0 ? "warning" : "success"}>{preview.rows.length} rows · {preview.warnings.length} warnings</Badge>
            {preview.accountMatchReference ? <span className="text-xs text-subdued">account {preview.accountMatchReference}</span> : null}
          </div>
          {preview.warnings.length > 0 ? (
            <details className="rounded border bg-muted/30 p-3 text-sm text-subdued">
              <summary className="cursor-pointer font-medium text-status-warning">{preview.warnings.length} skipped / flagged rows</summary>
              <ul className="mt-2 space-y-1">
                {preview.warnings.slice(0, 25).map((warning: any, index: number) => (
                  <li key={index}>Row {warning.rowNumber ?? "—"}: {warning.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase tracking-wide text-subdued">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 15).map((row: any, index: number) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums">{row.bookingDate}</td>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Number(row.amount) < 0 ? "text-status-danger" : "text-status-success"}`}>{fmt(row.amount, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-subdued">Preview writes nothing. Commit is idempotent — re-importing the same file imports no duplicates.</p>
        </Card>
      ) : null}
    </div>
  );
}

/* ----------------------------------- Review ---------------------------------- */

function ReviewPanel({ categories, onChanged }: Props & { onChanged: () => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/analysis/transactions?state=review&limit=100");
    const data = await response.json().catch(() => ({ transactions: [] }));
    setTransactions(data.transactions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function allocate(transaction: any) {
    const categoryId = selection[transaction.id] ?? categories[0]?.id;
    if (!categoryId) return;
    const { ok, data } = await postJson(`/api/analysis/transactions/${transaction.id}/allocate`, {
      allocations: [{ categoryId, amount: transaction.amount }],
      confirm: true,
    });
    if (!ok) { setMessage(data?.error?.message ?? "Allocation failed."); return; }
    await load();
    onChanged();
  }

  async function ignore(transaction: any) {
    await postJson(`/api/analysis/transactions/${transaction.id}/ignore`, { ignored: true });
    await load();
    onChanged();
  }

  async function applyRules() {
    const { ok, data } = await postJson("/api/analysis/rules/apply", { onlyUnreviewed: true });
    if (ok) { setMessage(`Applied rules: ${data.matched} of ${data.scanned} matched.`); await load(); onChanged(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subdued">Unknown activity stays here until you categorize it — nothing is silently assigned.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={applyRules}>Apply rules</Button>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </div>
      <RuleCreator categories={categories} onCreated={() => setMessage("Rule saved. Use Apply rules to run it.")} />
      <Notice>{message}</Notice>
      <Card className="p-0">
        {loading ? (
          <p className="p-5 text-sm text-subdued">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="p-5 text-sm text-subdued">Nothing awaiting review. Import a statement or apply rules.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase tracking-wide text-subdued">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b last:border-0 align-middle">
                    <td className="px-3 py-2 tabular-nums">{String(transaction.bookingDate).slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <span className="block">{transaction.description}</span>
                      <span className="text-xs text-subdued">{transaction.accountPocket?.account?.name} · {transaction.sourceInstitution}</span>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Number(transaction.amount) < 0 ? "text-status-danger" : "text-status-success"}`}>{fmt(transaction.amount, transaction.currency)}</td>
                    <td className="px-3 py-2">
                      <select
                        className="min-h-9 rounded border bg-muted px-2 text-sm"
                        value={selection[transaction.id] ?? ""}
                        onChange={(event) => setSelection((current) => ({ ...current, [transaction.id]: event.target.value }))}
                      >
                        <option value="">Select category…</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => allocate(transaction)}>Allocate</Button>
                        <button className="text-xs text-subdued hover:text-foreground" onClick={() => ignore(transaction)}>Ignore</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function RuleCreator({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [field, setField] = useState("merchant");
  const [type, setType] = useState("contains");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!pattern || !categoryId) return;
    const { ok, data } = await postJson("/api/analysis/rules", { matchField: field, matchType: type, pattern, categoryId, priority: 100 });
    setMessage(ok ? "Rule saved." : data?.error?.message ?? "Could not save rule.");
    if (ok) { setPattern(""); onCreated(); }
  }

  if (!open) {
    return <button className="text-sm text-brand-teal hover:underline" onClick={() => setOpen(true)}>+ Add an allocation rule</button>;
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs text-subdued">Pattern<input className={inputClass} value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="e.g. migros" /></label>
        <label className="grid gap-1 text-xs text-subdued">Field<select className={inputClass} value={field} onChange={(event) => setField(event.target.value)}>{["merchant", "description", "counterparty", "reference"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-subdued">Match<select className={inputClass} value={type} onChange={(event) => setType(event.target.value)}>{["contains", "exact", "prefix", "regex"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-subdued">Category<select className={inputClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <Button onClick={save}>Save</Button>
      </div>
      <Notice>{message}</Notice>
    </Card>
  );
}

/* ---------------------------------- Transfers -------------------------------- */

function TransfersPanel({ onChanged }: { onChanged: () => void }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/analysis/transfers");
    setMatches(await response.json().catch(() => []));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    const { ok, data } = await postJson("/api/analysis/transfers/scan", { windowDays: 3 });
    if (ok) { setMessage(`Scanned ${data.scanned}: ${data.created} new candidates, ${data.autoConfirmed} auto-confirmed.`); await load(); onChanged(); }
  }

  async function decide(id: string, decision: "confirmed" | "rejected") {
    await patchJson(`/api/analysis/transfers/${id}`, { decision });
    await load();
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subdued">Internal transfers and FX exchanges are matched and excluded from spending. High-confidence pairs auto-confirm.</p>
        <div className="flex gap-2"><Button onClick={scan}>Scan for transfers</Button><Button variant="secondary" onClick={load}>Refresh</Button></div>
      </div>
      <Notice>{message}</Notice>
      <Card className="p-0">
        {loading ? <p className="p-5 text-sm text-subdued">Loading…</p> : matches.length === 0 ? (
          <p className="p-5 text-sm text-subdued">No transfer matches yet. Run a scan after importing both sides of a transfer.</p>
        ) : (
          <div className="divide-y">
            {matches.map((match) => (
              <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={match.confidence} status={match.status} fx={match.evidence?.fx} />
                    <span className="text-subdued">score {Number(match.score).toFixed(2)}</span>
                  </div>
                  <p className="mt-1">
                    <span className="text-status-danger tabular-nums">{fmt(match.debitTransaction.amount, match.debitTransaction.currency)}</span>
                    {" "}({match.debitTransaction.accountPocket?.account?.name}) →{" "}
                    <span className="text-status-success tabular-nums">{fmt(match.creditTransaction.amount, match.creditTransaction.currency)}</span>
                    {" "}({match.creditTransaction.accountPocket?.account?.name})
                  </p>
                </div>
                {match.status === "CONFIRMED" ? (
                  <Badge tone="success">Confirmed</Badge>
                ) : match.status === "REJECTED" ? (
                  <Badge tone="neutral">Rejected</Badge>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => decide(match.id, "confirmed")}>Confirm</Button>
                    <button className="text-xs text-subdued hover:text-foreground" onClick={() => decide(match.id, "rejected")}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ConfidenceBadge({ confidence, status, fx }: { confidence: string; status: string; fx?: boolean }) {
  const tone = confidence === "HIGH" ? "success" : confidence === "MEDIUM" ? "warning" : "neutral";
  return <Badge tone={tone as any}>{fx ? "FX " : ""}{confidence.toLowerCase()}{status === "CANDIDATE" ? " candidate" : ""}</Badge>;
}

/* --------------------------------- Adherence --------------------------------- */

function AdherencePanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analysis/adherence").then((response) => response.json()).then((value) => { setData(value); setLoading(false); });
  }, []);

  if (loading) return <Card className="p-5 text-sm text-subdued">Loading…</Card>;
  if (!data || data.rows.length === 0) return <Card className="p-5 text-sm text-subdued">No allocated activity for {data?.month ?? "this month"} yet. Categorize transactions to see adherence.</Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {data.totals.map((total: any) => (
          <Card key={total.currency} className="px-5 py-3">
            <p className="text-xs text-subdued">Planned vs actual · {total.currency} · {data.month}</p>
            <p className="text-lg font-semibold tabular-nums">{fmt(total.actual, total.currency)} <span className="text-subdued">/ {fmt(total.planned, total.currency)}</span></p>
          </Card>
        ))}
      </div>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wide text-subdued">
              <tr><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Planned</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2">Status</th></tr>
            </thead>
            <tbody>
              {data.rows.map((row: any) => (
                <tr key={`${row.categoryId}${row.currency}`} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.categoryName}{row.essential ? <span className="ml-2 text-xs text-brand-teal">essential</span> : null}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.planned, row.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.actual, row.currency)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${Number(row.variance) < 0 ? "text-status-danger" : "text-status-success"}`}>{fmt(row.variance, row.currency)}</td>
                  <td className="px-3 py-2"><AdherenceBadge status={row.status} percent={row.usedPercent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdherenceBadge({ status, percent }: { status: string; percent: number | null }) {
  const tone = status === "over" ? "danger" : status === "no_plan" ? "warning" : status === "under" ? "success" : "neutral";
  const label = status === "no_plan" ? "unplanned" : status;
  return <Badge tone={tone as any}>{label}{percent != null ? ` · ${percent}%` : ""}</Badge>;
}

/* ---------------------------------- Findings --------------------------------- */

function FindingsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analysis/findings").then((response) => response.json()).then((value) => { setData(value); setLoading(false); });
  }, []);

  if (loading) return <Card className="p-5 text-sm text-subdued">Loading…</Card>;
  if (!data || data.findings.length === 0) return <Card className="p-5 text-sm text-subdued">No findings yet. Import and categorize a few months of activity to surface money leaks.</Card>;

  return (
    <div className="space-y-3">
      {data.findings.map((finding: any, index: number) => (
        <Card key={index} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={(finding.severity === "high" ? "danger" : finding.severity === "warning" ? "warning" : "neutral") as any}>{finding.severity}</Badge>
              <h3 className="font-medium">{finding.title}</h3>
            </div>
            <p className="mt-1 text-sm text-subdued">{finding.detail}</p>
          </div>
          {finding.amount ? <span className="text-sm font-semibold tabular-nums text-status-danger">{fmt(finding.amount, finding.currency ?? "CHF")}</span> : null}
        </Card>
      ))}
    </div>
  );
}
