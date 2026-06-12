"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

const inputClass = "mt-2 min-h-10 w-full rounded border bg-muted px-3 text-sm";

export function AccountEmailRequestForm({ kind }: { kind: "password-reset" | "verify-email" }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(data: FormData) {
    setPending(true);
    const response = await fetch(`/api/auth/${kind}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email") }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    setMessage(response.ok ? "If the account is eligible, an email has been sent." : result?.error?.message ?? "Request failed.");
  }
  return <form action={submit} className="grid gap-4">
    <label className="text-sm font-medium">Email<input className={inputClass} name="email" required type="email" /></label>
    <Button disabled={pending} type="submit">{pending ? "Sending…" : "Send email"}</Button>
    {message ? <p className="text-sm text-subdued" role="status">{message}</p> : null}
  </form>;
}

export function TokenCompleteForm({ kind, token }: { kind: "password-reset" | "verify-email"; token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(data: FormData) {
    setPending(true);
    const response = await fetch(`/api/auth/${kind}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...(kind === "password-reset" ? { password: data.get("password") } : {}) }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    setMessage(response.ok ? (kind === "password-reset" ? "Password reset. You can sign in now." : "Email verified. You can sign in now.") : result?.error?.message ?? "Request failed.");
  }
  return <form action={submit} className="grid gap-4">
    {kind === "password-reset" ? <label className="text-sm font-medium">New password<input className={inputClass} minLength={12} name="password" required type="password" /></label> : null}
    <Button disabled={pending} type="submit">{pending ? "Working…" : kind === "password-reset" ? "Reset password" : "Verify email"}</Button>
    {message ? <p className="text-sm text-subdued" role="status">{message}</p> : null}
  </form>;
}
