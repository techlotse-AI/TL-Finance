"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const inputClass = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

interface Enrollment {
  secret: string;
  otpauthUri: string;
}

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; data: { error?: { message?: string } } & Record<string, unknown> | null }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

/**
 * Two-factor authentication management on the Settings page. Enrollment shows
 * the secret and otpauth URI for manual entry into any authenticator app;
 * recovery codes are displayed exactly once after activation.
 */
export function TotpSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startEnrollment() {
    setPending(true);
    setMessage(null);
    const { ok, data } = await postJson("/api/auth/totp/enroll");
    setPending(false);
    if (!ok) {
      setMessage(data?.error?.message ?? "Could not start enrollment.");
      return;
    }
    setEnrollment(data as unknown as Enrollment);
  }

  async function activate(formData: FormData) {
    setPending(true);
    setMessage(null);
    const { ok, data } = await postJson("/api/auth/totp/activate", { code: formData.get("code") });
    setPending(false);
    if (!ok) {
      setMessage(data?.error?.message ?? "That code is not valid.");
      return;
    }
    setEnrollment(null);
    setEnabled(true);
    setRecoveryCodes((data?.recoveryCodes as string[]) ?? null);
    router.refresh();
  }

  async function disable(formData: FormData) {
    setPending(true);
    setMessage(null);
    const { ok, data } = await postJson("/api/auth/totp/disable", {
      password: formData.get("password"),
      code: formData.get("code"),
    });
    setPending(false);
    if (!ok) {
      setMessage(data?.error?.message ?? "Could not disable two-factor authentication.");
      return;
    }
    setEnabled(false);
    setRecoveryCodes(null);
    setMessage("Two-factor authentication is disabled.");
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-4 text-brand-teal" strokeWidth={1.5} />
        <h2 className="font-semibold">Two-factor authentication</h2>
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Off"}</Badge>
      </div>

      {recoveryCodes ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-status-warning">
            Save these recovery codes now — they are shown only once. Each works exactly one time
            if you lose access to your authenticator app.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded border bg-muted/30 p-4 font-mono text-sm tabular-nums">
            {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <Button onClick={() => setRecoveryCodes(null)} type="button">I have saved my recovery codes</Button>
        </div>
      ) : enrollment ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-subdued">
            Add the account to your authenticator app (Aegis, Google Authenticator, 1Password, …)
            using manual entry, then confirm with a current code.
          </p>
          <div className="rounded border bg-muted/30 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-subdued">Secret (base32, time-based, 6 digits, 30&nbsp;s)</p>
            <p className="mt-1 break-all font-mono">{enrollment.secret}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-subdued">Or the full otpauth link</p>
            <p className="mt-1 break-all font-mono text-xs text-subdued">{enrollment.otpauthUri}</p>
          </div>
          <form action={activate} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm text-subdued">
              Code from the app
              <input autoComplete="one-time-code" className={inputClass} inputMode="numeric" name="code" placeholder="123456" required />
            </label>
            <Button disabled={pending} type="submit">{pending ? "Verifying…" : "Turn on"}</Button>
            <button className="text-sm text-subdued hover:text-foreground" onClick={() => setEnrollment(null)} type="button">Cancel</button>
          </form>
        </div>
      ) : enabled ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-subdued">
            Signing in requires a code from your authenticator app. Disabling requires your
            password and a current code (or a recovery code).
          </p>
          <form action={disable} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm text-subdued">
              Password
              <input className={inputClass} name="password" required type="password" />
            </label>
            <label className="grid gap-1 text-sm text-subdued">
              Code or recovery code
              <input autoComplete="one-time-code" className={inputClass} name="code" required />
            </label>
            <Button disabled={pending} type="submit" variant="danger">{pending ? "Working…" : "Disable"}</Button>
          </form>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-subdued">
            Protect sign-in with a 6-digit code from an authenticator app in addition to your
            password. You will get one-time recovery codes in case you lose the device.
          </p>
          <Button disabled={pending} onClick={startEnrollment} type="button">
            {pending ? "Working…" : "Enable two-factor authentication"}
          </Button>
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-status-warning" role="status">{message}</p> : null}
    </Card>
  );
}
