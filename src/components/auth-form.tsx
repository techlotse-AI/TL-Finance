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
  /** Set after a correct password when TOTP is enabled; switches to the code step. */
  const [challenge, setChallenge] = useState<string | null>(null);

  function finish() {
    router.push("/");
    router.refresh();
  }

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
    const result = await response.json().catch(() => null) as { error?: { message?: string }; verificationRequired?: boolean; verificationDelivered?: boolean; totpRequired?: boolean; challenge?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(result?.error?.message ?? "The request could not be completed.");
      return;
    }
    if (mode === "signin" && result?.totpRequired && result.challenge) {
      setChallenge(result.challenge);
      return;
    }
    if (mode === "signup") {
      router.push(result?.verificationRequired ? `/signin?verification=${result.verificationDelivered ? "sent" : "retry"}` : "/onboarding");
      router.refresh();
      return;
    }
    finish();
  }

  async function submitCode(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/totp/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code: formData.get("code") }),
    });
    const result = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      // An expired challenge sends the user back to the password step.
      if (result?.error?.code === "totp_challenge_invalid") {
        setChallenge(null);
        setError(result.error.message ?? "The sign-in expired. Enter your password again.");
        return;
      }
      setError(result?.error?.message ?? "That code is not valid.");
      return;
    }
    finish();
  }

  if (challenge) {
    return (
      <form action={submitCode} className="grid gap-5">
        <div>
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="mt-1 text-sm text-subdued">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>
        </div>
        <label className="text-sm font-medium">
          Code
          <input
            autoComplete="one-time-code"
            autoFocus
            className={inputClass}
            inputMode="numeric"
            name="code"
            placeholder="123456"
            required
          />
        </label>
        {error ? <p className="text-sm text-status-danger" role="alert">{error}</p> : null}
        <Button disabled={pending} type="submit">{pending ? "Verifying…" : "Verify"}</Button>
        <button
          className="text-left text-sm text-subdued hover:text-foreground"
          onClick={() => { setChallenge(null); setError(null); }}
          type="button"
        >
          ← Back to password
        </button>
      </form>
    );
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
