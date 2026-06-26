"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface LifecycleSummary {
  incomeAllocations: number;
  outgoingTransfers: number;
  incomingTransfers: number;
  fundedBudgetItems: number;
  receivingBudgetItems: number;
  actualTransactions: number;
  statementImports: number;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  maskedReference: string | null;
  spending: boolean;
}

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

function activePlanReferences(summary: LifecycleSummary): number {
  return summary.incomeAllocations + summary.outgoingTransfers + summary.incomingTransfers +
    summary.fundedBudgetItems + summary.receivingBudgetItems;
}

function blockerMessage(summary: LifecycleSummary): string {
  const parts = [
    summary.incomeAllocations ? `${summary.incomeAllocations} income route(s)` : "",
    summary.outgoingTransfers + summary.incomingTransfers
      ? `${summary.outgoingTransfers + summary.incomingTransfers} planned transfer route(s)`
      : "",
    summary.fundedBudgetItems + summary.receivingBudgetItems
      ? `${summary.fundedBudgetItems + summary.receivingBudgetItems} budget-item route(s)`
      : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export function AccountActions({
  account,
  lifecycle,
}: {
  account: AccountRow;
  lifecycle: LifecycleSummary;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const blockers = activePlanReferences(lifecycle);
  const history = lifecycle.actualTransactions + lifecycle.statementImports;

  async function update(data: FormData) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/accounts/${encodeURIComponent(account.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        type: data.get("type"),
        institution: data.get("institution") || null,
        maskedReference: data.get("accountReference") || null,
        spending: data.get("spending") === "on",
      }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setMessage(result?.error?.message ?? "Update failed.");
      return;
    }
    setEditing(false);
    setMessage("Account updated.");
    router.refresh();
  }

  async function remove() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as {
      error?: { message?: string };
      preservedHistory?: { actualTransactions: number; statementImports: number };
    } | null;
    setPending(false);
    if (!response.ok) {
      setConfirmDelete(false);
      setMessage(result?.error?.message ?? "Delete failed.");
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <form action={update} className="grid min-w-72 gap-2">
        <label className="grid gap-1 text-xs text-subdued">Name<input className={input} defaultValue={account.name} name="name" required /></label>
        <label className="grid gap-1 text-xs text-subdued">Type<select className={input} defaultValue={account.type} name="type">
          {["personal", "savings", "investment", "retirement", "credit_card", "cash", "other"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs text-subdued">Institution<input className={input} defaultValue={account.institution ?? ""} name="institution" /></label>
        <label className="grid gap-1 text-xs text-subdued">IBAN / account reference<input autoComplete="off" className={input} defaultValue={account.maskedReference ?? ""} name="accountReference" /></label>
        <label className="flex items-center gap-2 text-xs text-subdued"><input defaultChecked={account.spending} name="spending" type="checkbox" /> Spending account</label>
        <div className="flex gap-2">
          <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</Button>
          <Button disabled={pending} onClick={() => setEditing(false)} type="button" variant="secondary"><X className="size-4" />Cancel</Button>
        </div>
        {message ? <p className="text-xs text-status-danger" role="alert">{message}</p> : null}
      </form>
    );
  }

  return (
    <div className="grid min-w-56 gap-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => { setEditing(true); setConfirmDelete(false); setMessage(null); }} type="button" variant="secondary"><Pencil className="size-4" />Edit</Button>
        {confirmDelete ? (
          <>
            <Button disabled={pending} onClick={remove} type="button" variant="danger">{pending ? "Deleting…" : "Confirm delete"}</Button>
            <Button disabled={pending} onClick={() => setConfirmDelete(false)} type="button" variant="secondary">Cancel</Button>
          </>
        ) : (
          <Button
            disabled={pending || blockers > 0}
            onClick={() => { setConfirmDelete(true); setMessage(null); }}
            title={blockers > 0 ? `Blocked by ${blockerMessage(lifecycle)}` : "Soft-delete account and preserve Analyze history"}
            type="button"
            variant="danger"
          >
            <Trash2 className="size-4" />Delete
          </Button>
        )}
      </div>
      {blockers > 0 ? <p className="text-xs text-status-warning">Delete blocked: {blockerMessage(lifecycle)}.</p> : null}
      {blockers === 0 && history > 0 ? <p className="text-xs text-subdued">Delete preserves {history} Analyze history reference(s).</p> : null}
      {confirmDelete ? <p className="text-xs text-status-warning">This removes the account from Budget and future imports. Historical Analyze records remain linked.</p> : null}
      {message ? <p className="text-xs text-subdued" role="status">{message}</p> : null}
    </div>
  );
}
