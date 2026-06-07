"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const inputClass =
  "mt-2 min-h-10 w-full rounded border bg-muted px-3 text-sm text-foreground placeholder:text-subdued";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setError(result?.error?.message ?? "The request could not be completed.");
      return;
    }
    router.push(mode === "signup" ? "/onboarding" : "/");
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-5">
      <label className="text-sm font-medium">
        Email
        <input className={inputClass} name="email" required type="email" />
      </label>
      <label className="text-sm font-medium">
        Password
        <input className={inputClass} minLength={mode === "signup" ? 12 : 1} name="password" required type="password" />
      </label>
      {error ? <p className="text-sm text-status-danger" role="alert">{error}</p> : null}
      <Button disabled={pending} type="submit">{pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
    </form>
  );
}
