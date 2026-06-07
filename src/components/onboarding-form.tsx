"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const inputClass =
  "mt-2 min-h-10 w-full rounded border bg-muted px-3 text-sm text-foreground placeholder:text-subdued";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        baseCurrency: formData.get("baseCurrency"),
        countryProfile: formData.get("countryProfile"),
      }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setError(result?.error?.message ?? "The household could not be created.");
      return;
    }
    router.push("/accounts");
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-5">
      <label className="text-sm font-medium">
        Household name
        <input className={inputClass} name="name" placeholder="Example household" required />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Base currency
          <select className={inputClass} defaultValue="CHF" name="baseCurrency">
            <option value="CHF">CHF</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="ZAR">ZAR</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Category preset
          <select className={inputClass} defaultValue="swiss" name="countryProfile">
            <option value="swiss">Swiss</option><option value="generic">Generic</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-status-danger" role="alert">{error}</p> : null}
      <Button disabled={pending} type="submit">{pending ? "Creating…" : "Create household"}</Button>
    </form>
  );
}
