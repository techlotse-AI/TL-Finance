"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

export function UserBackupImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(data: FormData) {
    const file = data.get("file");
    if (!(file instanceof File)) return;
    setPending(true);
    const response = await fetch("/api/user/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await file.text(),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string }; importedHouseholdIds?: string[] } | null;
    setPending(false);
    setMessage(response.ok ? `Imported ${result?.importedHouseholdIds?.length ?? 0} household backup(s).` : result?.error?.message ?? "Import failed.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Import user backup</h2>
      <p className="mt-2 text-sm text-subdued">Restores every household in the backup as a separate owned household.</p>
      <form action={submit} className="mt-4 grid gap-3">
        <input accept="application/json" className={input} name="file" required type="file" />
        <Button disabled={pending} type="submit">{pending ? "Importing…" : "Import user backup"}</Button>
      </form>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}

export function ExchangeRateRefreshButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setPending(true);
    const response = await fetch("/api/exchange-rates/refresh", { method: "POST" });
    const result = await response.json().catch(() => null) as { error?: { message?: string }; rates?: unknown[] } | null;
    setPending(false);
    setMessage(response.ok ? `Stored ${result?.rates?.length ?? 0} reference rate(s).` : result?.error?.message ?? "Refresh failed.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Reference exchange rates</h2>
      <p className="mt-2 text-sm text-subdued">Refresh account-currency reporting rates from Frankfurter’s free institutional reference-rate API.</p>
      <Button className="mt-4" disabled={pending} onClick={refresh} type="button" variant="secondary">{pending ? "Refreshing…" : "Refresh rates"}</Button>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}
