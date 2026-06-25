"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";
const kinds = ["income", "expense", "saving", "investment", "retirement"];

export interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  essential: boolean;
  groupId: string;
  /** True when active budget items or income sources still reference this category. */
  inUse: boolean;
}

/**
 * Inline edit and delete for a budget category. Editing updates the name, kind,
 * group, and essential flag. Delete is allowed only when the category is unused
 * (the API also enforces this and returns a clear error if it is still
 * referenced); it is a soft delete.
 */
export function CategoryActions({
  category,
  groups,
}: {
  category: CategoryRow;
  groups: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function update(data: FormData) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        kind: data.get("kind"),
        groupId: data.get("groupId"),
        essential: data.get("essential") === "on",
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
    const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
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
        <label className="grid gap-1 text-xs text-subdued">Name<input className={input} defaultValue={category.name} name="name" required /></label>
        <label className="grid gap-1 text-xs text-subdued">Kind<select className={input} defaultValue={category.kind} name="kind">
          {kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs text-subdued">Group<select className={input} defaultValue={category.groupId} name="groupId">
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>
        <label className="flex items-center gap-2 text-xs text-subdued"><input defaultChecked={category.essential} name="essential" type="checkbox" /> Essential</label>
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
        <Button
          disabled={pending || category.inUse}
          onClick={() => { setConfirmDelete(true); setMessage(null); }}
          title={category.inUse ? "In use by active plan rows — cannot delete" : "Soft-delete this category"}
          type="button"
          variant="danger"
        >
          <Trash2 className="size-4" />Delete
        </Button>
      )}
      {category.inUse && !confirmDelete ? <p className="w-full text-xs text-status-warning">In use — reassign or remove referencing rows first.</p> : null}
      {message ? <p className="w-full text-xs text-status-danger" role="alert">{message}</p> : null}
    </div>
  );
}
