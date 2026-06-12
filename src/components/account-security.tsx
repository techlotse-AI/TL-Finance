"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export function SessionManagement({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function revoke(id: string) {
    const response = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setMessage(response.ok ? "Session revoked." : result?.error?.message ?? "Could not revoke session.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Active sessions</h2>
      <p className="mt-2 text-sm text-subdued">Revoke sessions you no longer recognize.</p>
      <ul className="mt-4 divide-y">
        {sessions.map((session) => (
          <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={session.id}>
            <div>
              <p>{session.current ? "Current session" : `Session ${session.id.slice(0, 8)}`}</p>
              <p className="text-xs text-subdued">Created {new Date(session.createdAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}</p>
            </div>
            {session.current ? <span className="text-xs text-brand-teal">Current</span> : <Button onClick={() => revoke(session.id)} type="button" variant="secondary">Revoke</Button>}
          </li>
        ))}
      </ul>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}
