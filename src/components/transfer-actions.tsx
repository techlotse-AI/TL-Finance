"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Delete (soft-delete) a planned account transfer. A two-step confirm guards
 * against accidental removal; on success the list refreshes.
 */
export function TransferActions({ transfer }: { transfer: { id: string; name: string } }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/planned-transfers/${encodeURIComponent(transfer.id)}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setConfirmDelete(false);
      setMessage(result?.error?.message ?? "Delete failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmDelete ? (
        <>
          <Button disabled={pending} onClick={remove} type="button" variant="danger">{pending ? "Deleting…" : "Confirm"}</Button>
          <Button disabled={pending} onClick={() => setConfirmDelete(false)} type="button" variant="secondary">Cancel</Button>
        </>
      ) : (
        <Button disabled={pending} onClick={() => { setConfirmDelete(true); setMessage(null); }} type="button" variant="danger" title={`Delete transfer “${transfer.name}”`}><Trash2 className="size-4" />Delete</Button>
      )}
      {message ? <p className="w-full text-xs text-status-danger" role="alert">{message}</p> : null}
    </div>
  );
}
