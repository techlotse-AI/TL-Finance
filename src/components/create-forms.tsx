"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Recurrence } from "@/lib/budget/recurrence";
import { supportedCurrencies } from "@/lib/money/currencies";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";
const recurrenceOptions: Array<{ value: Recurrence; label: string }> = [
  { value: "once", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom_months", label: "Selected months" },
];
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2026, index).toLocaleString("en", { month: "short" })
);

function defaultSupportedCurrency(baseCurrency: string) {
  return supportedCurrencies.find((currency) => currency === baseCurrency) ?? supportedCurrencies[0];
}

function ApiCreateForm({
  endpoint, title, buildBody, children, disabled = false, disabledMessage,
}: {
  endpoint: string; title: string; buildBody: (data: FormData) => unknown; children: ReactNode;
  disabled?: boolean; disabledMessage?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(data: FormData) {
    setPending(true); setMessage(null);
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(data)),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) { setMessage(result?.error?.message ?? "Request failed."); return; }
    setMessage("Created."); router.refresh();
  }
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <form action={submit} className="grid gap-3">
        {children}
        {disabledMessage ? <p className="text-sm text-status-warning">{disabledMessage}</p> : null}
        <Button disabled={pending || disabled} type="submit">{pending ? "Saving…" : "Create"}</Button>
      </form>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}

export function AccountCreateForm({ baseCurrency }: { baseCurrency: string }) {
  const defaultCurrency = defaultSupportedCurrency(baseCurrency);
  return <ApiCreateForm endpoint="/api/accounts" title="Add account" buildBody={(d) => ({
    name: d.get("name"), type: d.get("type"), institution: d.get("institution") || null,
    maskedReference: d.get("accountReference") || null,
    supportedCurrencies: d.getAll("supportedCurrencies"),
  })}>
    <label className="grid gap-2 text-sm text-subdued">Account name<input className={input} name="name" required /></label>
    <label className="grid gap-2 text-sm text-subdued">Account type<select className={input} name="type" defaultValue="personal">
      {["personal", "savings", "investment", "retirement", "credit_card", "cash", "other"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
    </select></label>
    <label className="grid gap-2 text-sm text-subdued">Institution<input className={input} name="institution" placeholder="Optional" /></label>
    <label className="grid gap-2 text-sm text-subdued">
      IBAN / account reference
      <input autoComplete="off" className={input} name="accountReference" placeholder="Optional; stored masked" />
    </label>
    <fieldset className="grid gap-2 rounded border bg-muted/30 p-3">
      <legend className="px-1 text-sm font-semibold">Supported currencies</legend>
      <div className="flex flex-wrap gap-4">
        {supportedCurrencies.map((currency) => (
          <label className="flex items-center gap-2 text-sm text-subdued" key={currency}>
            <input defaultChecked={currency === defaultCurrency} name="supportedCurrencies" type="checkbox" value={currency} />
            {currency}
          </label>
        ))}
      </div>
      <p className="text-xs text-subdued">Currency routes are created automatically inside this account.</p>
    </fieldset>
  </ApiCreateForm>;
}

export function PocketCreateForm({ accounts, baseCurrency }: { accounts: Array<{ id: string; name: string }>; baseCurrency: string }) {
  const defaultCurrency = defaultSupportedCurrency(baseCurrency);
  return <ApiCreateForm endpoint="/api/account-pockets" title="Add currency to existing account" buildBody={(d) => ({
    accountId: d.get("accountId"), name: d.get("currency"), currency: d.get("currency"),
  })}>
    <label className="grid gap-2 text-sm text-subdued">Account<select className={input} name="accountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="grid gap-2 text-sm text-subdued">Currency<select className={input} defaultValue={defaultCurrency} name="currency">
      {supportedCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
    </select></label>
    <p className="text-xs text-subdued">Adds the selected currency route to the account.</p>
  </ApiCreateForm>;
}

export function IncomeCreateForm({
  baseCurrency,
  categories,
  pockets,
}: {
  baseCurrency: string;
  categories: Array<{ id: string; name: string }>;
  pockets: Array<{ id: string; name: string; currency: string; accountName: string }>;
}) {
  const [currency, setCurrency] = useState<string>(defaultSupportedCurrency(baseCurrency));
  const matchingPockets = useMemo(
    () => pockets.filter((pocket) => pocket.currency === currency),
    [currency, pockets],
  );
  const missing: string[] = [];
  if (categories.length === 0) missing.push("an income category");
  if (pockets.length === 0) missing.push("an active account with a supported currency");

  return <ApiCreateForm
    buildBody={(d) => ({
    name: d.get("name"), categoryId: d.get("categoryId"), amount: d.get("amount"), currency: d.get("currency"),
    recurrence: "monthly", selectedMonths: [], startDate: new Date().toISOString(),
    allocations: [{ accountPocketId: d.get("pocketId"), method: "percentage", percentage: "1.000000", sourceCurrency: d.get("currency") }],
    })}
    disabled={missing.length > 0}
    disabledMessage={missing.length > 0 ? `Create ${missing.join(" and ")} before adding income.` : undefined}
    endpoint="/api/income-sources"
    title="Add monthly income"
  >
    <label className="grid gap-2 text-sm text-subdued">
      Income name
      <input className={input} name="name" required />
    </label>
    <label className="grid gap-2 text-sm text-subdued">
      Income category
      <select className={input} name="categoryId" required>
        {categories.length === 0 ? <option value="">No income categories available</option> : null}
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-[1fr_96px] gap-3">
      <label className="grid gap-2 text-sm text-subdued">
        Amount
        <input className={input} inputMode="decimal" name="amount" required />
      </label>
      <label className="grid gap-2 text-sm text-subdued">
        Currency
        <select className={input} name="currency" onChange={(event) => setCurrency(event.target.value)} value={currency}>
          {supportedCurrencies.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
    </div>
    <label className="grid gap-2 text-sm text-subdued">
      Receiving account
      <select className={input} key={currency} name="pocketId" required>
        {matchingPockets.length === 0 ? <option value="">No accounts support {currency}</option> : null}
        {matchingPockets.map((pocket) => (
          <option key={pocket.id} value={pocket.id}>
            {pocket.accountName} · {pocket.currency}
          </option>
        ))}
      </select>
    </label>
  </ApiCreateForm>;
}

export function TransferCreateForm({ pockets }: { pockets: Array<{ id: string; currency: string; accountName: string }> }) {
  return <ApiCreateForm endpoint="/api/planned-transfers" title="Add monthly transfer" buildBody={(d) => ({
    name: d.get("name"), fromAccountPocketId: d.get("from"), toAccountPocketId: d.get("to"),
    amount: d.get("amount"), currency: d.get("currency"), recurrence: "monthly", selectedMonths: [], startDate: new Date().toISOString(),
  })}>
    <input className={input} name="name" placeholder="Transfer name" required />
    <select className={input} name="from" required>{pockets.map((p) => <option key={p.id} value={p.id}>From: {p.accountName} · {p.currency}</option>)}</select>
    <select className={input} name="to" required>{pockets.map((p) => <option key={p.id} value={p.id}>To: {p.accountName} · {p.currency}</option>)}</select>
    <div className="grid grid-cols-[1fr_96px] gap-3"><input className={input} name="amount" placeholder="Amount" required /><input className={input} defaultValue="CHF" name="currency" required /></div>
  </ApiCreateForm>;
}

export function BudgetItemCreateForm({
  baseCurrency,
  categories,
  pockets,
}: {
  baseCurrency: string;
  categories: Array<{ id: string; name: string; kind: string }>;
  pockets: Array<{ id: string; currency: string; accountName: string; accountType: string }>;
}) {
  const [kind, setKind] = useState("expense");
  const [currency, setCurrency] = useState<string>(defaultSupportedCurrency(baseCurrency));
  const [recurrence, setRecurrence] = useState<Recurrence>("monthly");
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  );
  const matchingRoutes = useMemo(
    () => pockets.filter((pocket) => pocket.currency === currency),
    [currency, pockets],
  );
  const destinationAccountType = kind === "saving" ? "savings" : kind;
  const destinationRoutes = useMemo(
    () => matchingRoutes.filter((pocket) => pocket.accountType === destinationAccountType),
    [destinationAccountType, matchingRoutes],
  );

  return <ApiCreateForm
    disabled={recurrence === "custom_months" && selectedMonths.length === 0}
    disabledMessage={recurrence === "custom_months" && selectedMonths.length === 0 ? "Select at least one payment month." : undefined}
    endpoint="/api/budget-items"
    title="Add budget item"
    buildBody={(d) => {
    const kind = String(d.get("kind"));
    return {
      name: d.get("name"), categoryId: d.get("categoryId"), kind, amount: d.get("amount"), currency: d.get("currency"),
      recurrence: d.get("recurrence"), selectedMonths: d.getAll("selectedMonths").map(Number),
      startDate: new Date().toISOString(), essential: d.get("essential") === "on",
      paidFromAccountPocketId: d.get("from") || null, paidToAccountPocketId: kind === "expense" ? null : d.get("to") || null,
    };
  }}>
    <label className="grid gap-2 text-sm text-subdued">Budget item name<input className={input} name="name" required /></label>
    <label className="grid gap-2 text-sm text-subdued">Item kind<select
      className={input}
      name="kind"
      onChange={(event) => setKind(event.target.value)}
      value={kind}
    >{["expense", "saving", "investment", "retirement"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="grid gap-2 text-sm text-subdued">Category<select className={input} key={kind} name="categoryId" required>
      {filteredCategories.length === 0 ? <option value="">No {kind} categories available</option> : null}
      {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select></label>
    <div className="grid gap-3 md:grid-cols-[1fr_180px_112px]">
      <label className="grid gap-2 text-sm text-subdued">{amountLabel(recurrence)}<input className={input} inputMode="decimal" name="amount" required /></label>
      <label className="grid gap-2 text-sm text-subdued">Recurrence<select
        className={input}
        name="recurrence"
        onChange={(event) => setRecurrence(event.target.value as Recurrence)}
        value={recurrence}
      >
        {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label className="grid gap-2 text-sm text-subdued">Currency<select className={input} name="currency" onChange={(event) => setCurrency(event.target.value)} value={currency}>
        {supportedCurrencies.map((value) => <option key={value}>{value}</option>)}
      </select></label>
    </div>
    {recurrence === "custom_months" ? (
      <fieldset className="grid gap-2 rounded border bg-muted/30 p-3">
        <legend className="px-1 text-sm font-semibold">Payment months</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {monthNames.map((month, index) => (
            <label className="flex items-center gap-2 text-sm text-subdued" key={month}>
              <input
                checked={selectedMonths.includes(index + 1)}
                name="selectedMonths"
                onChange={(event) => setSelectedMonths((current) =>
                  event.target.checked
                    ? [...current, index + 1].sort((a, b) => a - b)
                    : current.filter((value) => value !== index + 1)
                )}
                type="checkbox"
                value={index + 1}
              />
              {month}
            </label>
          ))}
        </div>
      </fieldset>
    ) : null}
    <p className="rounded border bg-muted/30 px-3 py-2 text-sm text-subdued">{recurrenceGuidance(recurrence)}</p>
    <label className="grid gap-2 text-sm text-subdued">Paid from account<select className={input} key={`from:${currency}`} name="from">
      <option value="">{kind === "expense" ? "Unallocated expense" : "Select funding account"}</option>
      {matchingRoutes.map((route) => <option key={route.id} value={route.id}>{route.accountName} · {route.currency}</option>)}
    </select></label>
    {kind === "expense" ? (
      <p className="rounded border bg-muted/30 px-3 py-2 text-sm text-subdued">Expenses leave the household and do not need a destination account.</p>
    ) : (
      <label className="grid gap-2 text-sm text-subdued">Paid to {kind} account<select className={input} key={`to:${kind}:${currency}`} name="to" required>
        <option value="">Select destination account</option>
        {destinationRoutes.map((route) => <option key={route.id} value={route.id}>{route.accountName} · {route.currency}</option>)}
      </select></label>
    )}
    <label className="flex items-start gap-2 text-sm text-subdued">
      <input className="mt-1" name="essential" type="checkbox" />
      <span><strong className="text-foreground">Essential</strong><span className="block text-xs">Marks required household spending for adherence and future emergency-fund calculations. It does not change the budget total.</span></span>
    </label>
  </ApiCreateForm>;
}

function amountLabel(recurrence: Recurrence) {
  if (recurrence === "once") return "One-time amount";
  if (recurrence === "weekly") return "Weekly amount";
  if (recurrence === "monthly") return "Monthly amount";
  if (recurrence === "quarterly") return "Quarterly amount";
  if (recurrence === "yearly") return "Annual amount";
  return "Amount per selected month";
}

function recurrenceGuidance(recurrence: Recurrence) {
  if (recurrence === "once") return "Enter the full one-time amount. It is excluded from the recurring monthly baseline.";
  if (recurrence === "weekly") return "Enter the amount paid each week. The monthly baseline uses weekly amount × 52 ÷ 12.";
  if (recurrence === "monthly") return "Enter the amount paid each month.";
  if (recurrence === "quarterly") return "Enter the full amount paid each quarter. The monthly baseline divides it by 3.";
  if (recurrence === "yearly") return "Enter the full annual amount. The monthly baseline divides it evenly by 12.";
  return "Enter the amount paid in each selected month. The monthly baseline spreads the selected payments across 12 months.";
}

export function CategoryCreateForm({ groups }: { groups: Array<{ id: string; name: string }> }) {
  return <ApiCreateForm endpoint="/api/categories" title="Add category" buildBody={(d) => ({
    groupId: d.get("groupId"), name: d.get("name"), kind: d.get("kind"), essential: d.get("essential") === "on", sortOrder: 100,
  })}>
    <input className={input} name="name" placeholder="Category name" required />
    <select className={input} name="groupId">{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
    <select className={input} name="kind">{["income", "expense", "saving", "investment", "retirement"].map((k) => <option key={k}>{k}</option>)}</select>
    <label className="flex gap-2 text-sm text-subdued"><input name="essential" type="checkbox" /> Essential</label>
  </ApiCreateForm>;
}

export function MemberAddForm() {
  return <ApiCreateForm endpoint="/api/members" title="Add existing user" buildBody={(d) => ({
    email: d.get("email"), role: d.get("role"),
  })}>
    <input className={input} name="email" placeholder="member@example.com" required type="email" />
    <select className={input} name="role"><option value="member">member</option><option value="admin">admin</option></select>
  </ApiCreateForm>;
}

export function TierAssignForm({ households }: { households: Array<{ id: string; name: string }> }) {
  return <ApiCreateForm endpoint="/api/admin/tiers" title="Assign household tier" buildBody={(d) => ({
    householdId: d.get("householdId"), tier: d.get("tier"), active: true,
  })}>
    <select className={input} name="householdId">{households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
    <select className={input} name="tier"><option value="budget">budget</option><option value="analyze">analyze</option><option value="optimize">optimize</option></select>
  </ApiCreateForm>;
}

export function HouseholdImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(data: FormData) {
    const file = data.get("file");
    if (!(file instanceof File)) return;
    const response = await fetch("/api/household/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text(),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setMessage(response.ok ? "Imported." : result?.error?.message ?? "Import failed.");
    if (response.ok) { router.push("/"); router.refresh(); }
  }
  return <Card className="p-5"><h2 className="font-semibold">Import household JSON</h2><form action={submit} className="mt-4 grid gap-3"><input accept="application/json" className={input} name="file" required type="file" /><Button type="submit">Import</Button></form>{message ? <p className="mt-3 text-sm text-subdued">{message}</p> : null}</Card>;
}

export function ExchangeRateCreateForm({ baseCurrency }: { baseCurrency: string }) {
  return <ApiCreateForm endpoint="/api/exchange-rates" title="Add reporting exchange rate" buildBody={(d) => {
    const asOf = new Date();
    const staleAfter = new Date(asOf.getTime() + 24 * 60 * 60 * 1000);
    return {
      fromCurrency: d.get("fromCurrency"), toCurrency: baseCurrency, rate: d.get("rate"),
      source: d.get("source"), asOf: asOf.toISOString(), staleAfter: staleAfter.toISOString(),
    };
  }}>
    <div className="grid grid-cols-[96px_1fr] gap-3"><input className={input} maxLength={3} name="fromCurrency" placeholder="EUR" required /><input className={input} name="rate" placeholder={`Rate to ${baseCurrency}`} required /></div>
    <input className={input} name="source" placeholder="Rate source" required />
  </ApiCreateForm>;
}
