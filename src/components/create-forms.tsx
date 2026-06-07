"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

function ApiCreateForm({
  endpoint, title, buildBody, children,
}: {
  endpoint: string; title: string; buildBody: (data: FormData) => unknown; children: ReactNode;
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
      <form action={submit} className="grid gap-3">{children}<Button disabled={pending} type="submit">{pending ? "Saving…" : "Create"}</Button></form>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}

export function AccountCreateForm() {
  return <ApiCreateForm endpoint="/api/accounts" title="Add account" buildBody={(d) => ({
    name: d.get("name"), type: d.get("type"), institution: d.get("institution") || null, maskedReference: null,
  })}>
    <input className={input} name="name" placeholder="Account name" required />
    <select className={input} name="type" defaultValue="personal">
      {["personal", "savings", "investment", "retirement", "credit_card", "cash", "other"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
    </select>
    <input className={input} name="institution" placeholder="Institution (optional)" />
  </ApiCreateForm>;
}

export function PocketCreateForm({ accounts }: { accounts: Array<{ id: string; name: string }> }) {
  return <ApiCreateForm endpoint="/api/account-pockets" title="Add currency pocket" buildBody={(d) => ({
    accountId: d.get("accountId"), name: d.get("name"), currency: d.get("currency"),
  })}>
    <select className={input} name="accountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <input className={input} name="name" placeholder="Pocket name" required />
    <input className={input} defaultValue="CHF" maxLength={3} name="currency" required />
  </ApiCreateForm>;
}

export function IncomeCreateForm({ categories, pockets }: { categories: Array<{ id: string; name: string }>; pockets: Array<{ id: string; name: string; currency: string }> }) {
  return <ApiCreateForm endpoint="/api/income-sources" title="Add monthly income" buildBody={(d) => ({
    name: d.get("name"), categoryId: d.get("categoryId"), amount: d.get("amount"), currency: d.get("currency"),
    recurrence: "monthly", selectedMonths: [], startDate: new Date().toISOString(),
    allocations: [{ accountPocketId: d.get("pocketId"), method: "percentage", percentage: "1.000000", sourceCurrency: d.get("currency") }],
  })}>
    <input className={input} name="name" placeholder="Income name" required />
    <select className={input} name="categoryId" required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <div className="grid grid-cols-[1fr_96px] gap-3"><input className={input} name="amount" placeholder="Amount" required /><input className={input} defaultValue="CHF" name="currency" required /></div>
    <select className={input} name="pocketId" required>{pockets.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.currency}</option>)}</select>
  </ApiCreateForm>;
}

export function TransferCreateForm({ pockets }: { pockets: Array<{ id: string; name: string; currency: string }> }) {
  return <ApiCreateForm endpoint="/api/planned-transfers" title="Add monthly transfer" buildBody={(d) => ({
    name: d.get("name"), fromAccountPocketId: d.get("from"), toAccountPocketId: d.get("to"),
    amount: d.get("amount"), currency: d.get("currency"), recurrence: "monthly", selectedMonths: [], startDate: new Date().toISOString(),
  })}>
    <input className={input} name="name" placeholder="Transfer name" required />
    <select className={input} name="from" required>{pockets.map((p) => <option key={p.id} value={p.id}>From: {p.name} · {p.currency}</option>)}</select>
    <select className={input} name="to" required>{pockets.map((p) => <option key={p.id} value={p.id}>To: {p.name} · {p.currency}</option>)}</select>
    <div className="grid grid-cols-[1fr_96px] gap-3"><input className={input} name="amount" placeholder="Amount" required /><input className={input} defaultValue="CHF" name="currency" required /></div>
  </ApiCreateForm>;
}

export function BudgetItemCreateForm({ categories, pockets }: { categories: Array<{ id: string; name: string; kind: string }>; pockets: Array<{ id: string; name: string; currency: string }> }) {
  return <ApiCreateForm endpoint="/api/budget-items" title="Add monthly budget item" buildBody={(d) => {
    const kind = String(d.get("kind"));
    return {
      name: d.get("name"), categoryId: d.get("categoryId"), kind, amount: d.get("amount"), currency: d.get("currency"),
      recurrence: "monthly", selectedMonths: [], startDate: new Date().toISOString(), essential: d.get("essential") === "on",
      paidFromAccountPocketId: d.get("from") || null, paidToAccountPocketId: kind === "expense" ? null : d.get("to") || null,
    };
  }}>
    <input className={input} name="name" placeholder="Budget item name" required />
    <select className={input} name="kind" defaultValue="expense">{["expense", "saving", "investment", "retirement"].map((k) => <option key={k}>{k}</option>)}</select>
    <select className={input} name="categoryId" required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kind.toLowerCase()})</option>)}</select>
    <div className="grid grid-cols-[1fr_96px] gap-3"><input className={input} name="amount" placeholder="Amount" required /><input className={input} defaultValue="CHF" name="currency" required /></div>
    <select className={input} name="from"><option value="">Unallocated expense</option>{pockets.map((p) => <option key={p.id} value={p.id}>From: {p.name} · {p.currency}</option>)}</select>
    <select className={input} name="to"><option value="">No destination</option>{pockets.map((p) => <option key={p.id} value={p.id}>To: {p.name} · {p.currency}</option>)}</select>
    <label className="flex gap-2 text-sm text-subdued"><input name="essential" type="checkbox" /> Essential</label>
  </ApiCreateForm>;
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
