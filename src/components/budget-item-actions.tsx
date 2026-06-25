"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

export interface BudgetItemRow {
  id: string;
  name: string;
  amount: string;
  currency: string;
  kind: string;
  recurrence: string;
  selectedMonths: number[];
  startDate: string;
  essential: boolean;
  categoryId: string;
  paidFromAccountPocketId: string | null;
  paidToAccountPocketId: string | null;
}

/**
 * Inline edit and soft-delete for a budget item. Editing keeps the item's kind,
 * recurrence, currency, and account routes unchanged (those are structural) and
 * lets the user adjust the name, amount, category (same kind), and essential
 * flag — the fields users most often correct. Delete is a soft delete.
 */
export function BudgetItemActions({
  item,
  categories,
}: {
  item: BudgetItemRow;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sameKindCategories = useMemo(
    () => categories.filter((category) => category.kind === item.kind),
    [categories, item.kind],
  );

  async function update(data: FormData) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/budget-items/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        categoryId: data.get("categoryId"),
        kind: item.kind,
        amount: data.get("amount"),
        currency: item.currency,
        recurrence: item.recurrence,
        selectedMonths: item.selectedMonths,
        startDate: item.startDate,
        essential: data.get("essential") === "on",
        paidFromAccountPocketId: item.paidFromAccountPocketId,
        paidToAccountPocketId: item.paidToAccountPocketId,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setMessage(result?.error?.message ?? "Update failed.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/budget-items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
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
      <form action={update} className="grid min-w-64 gap-2">
        <label className="grid gap-1 text-xs text-subdued">Name<input className={input} defaultValue={item.name} name="name" required /></label>
        <label className="grid gap-1 text-xs text-subdued">Category<select className={input} defaultValue={item.categoryId} name="categoryId" required>
          {sameKindCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs text-subdued">Amount ({item.currency})<input className={input} defaultValue={item.amount} inputMode="decimal" name="amount" required /></label>
        <label className="flex items-center gap-2 text-xs text-subdued"><input defaultChecked={item.essential} name="essential" type="checkbox" /> Essential</label>
        <div className="flex gap-2">
          <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</Button>
          <Button disabled={pending} onClick={() => setEditing(false)} type="button" variant="secondary"><X className="size-4" />Cancel</Button>
        </div>
        {message ? <p className="text-xs text-status-danger" role="alert">{message}</p> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={pending} onClick={() => { setEditing(true); setConfirmDelete(false); setMessage(null); }} type="button" variant="secondary"><Pencil className="size-4" />Edit</Button>
      {confirmDelete ? (
        <>
          <Button disabled={pending} onClick={remove} type="button" variant="danger">{pending ? "Deleting…" : "Confirm"}</Button>
          <Button disabled={pending} onClick={() => setConfirmDelete(false)} type="button" variant="secondary">Cancel</Button>
        </>
      ) : (
        <Button disabled={pending} onClick={() => { setConfirmDelete(true); setMessage(null); }} type="button" variant="danger" title="Soft-delete this budget item"><Trash2 className="size-4" />Delete</Button>
      )}
      {message ? <p className="w-full text-xs text-status-danger" role="alert">{message}</p> : null}
    </div>
  );
}
