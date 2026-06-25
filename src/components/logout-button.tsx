"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Signs the current session out via the audited signout endpoint, then sends the
 * user to the sign-in page. The button stays disabled while the request is in
 * flight to avoid double submits.
 */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/json" } });
    } catch {
      // Even if the network call fails, fall through to the sign-in page; the
      // cookie is httpOnly and the server clears it on the next authenticated load.
    }
    router.push("/signin");
    router.refresh();
  }

  return (
    <button
      className="flex min-h-10 w-full items-center gap-3 rounded px-3 text-sm text-subdued transition hover:bg-muted hover:text-foreground disabled:opacity-60"
      disabled={pending}
      onClick={signOut}
      type="button"
    >
      <LogOut aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
      <span className="truncate">{pending ? "Signing out…" : "Log out"}</span>
    </button>
  );
}
