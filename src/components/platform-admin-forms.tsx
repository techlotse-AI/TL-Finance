"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

interface ManagedUser {
  id: string;
  email: string;
  active: boolean;
  instanceAdmin: boolean;
}

export function UserManagementForm({ users }: { users: ManagedUser[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const selected = users.find((user) => user.id === selectedId);
  const [active, setActive] = useState(selected?.active ?? true);
  const [instanceAdmin, setInstanceAdmin] = useState(selected?.instanceAdmin ?? false);
  const [message, setMessage] = useState<string | null>(null);

  function selectUser(userId: string) {
    const user = users.find((candidate) => candidate.id === userId);
    setSelectedId(userId);
    setActive(user?.active ?? true);
    setInstanceAdmin(user?.instanceAdmin ?? false);
  }

  async function submit() {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedId, active, instanceAdmin }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setMessage(response.ok ? "User updated." : result?.error?.message ?? "Update failed.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">User management</h2>
      <div className="mt-4 grid gap-3">
        <select className={input} onChange={(event) => selectUser(event.target.value)} value={selectedId}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-subdued"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> Active</label>
        <label className="flex items-center gap-2 text-sm text-subdued"><input checked={instanceAdmin} onChange={(event) => setInstanceAdmin(event.target.checked)} type="checkbox" /> Instance administrator</label>
        <Button disabled={!selectedId} onClick={submit} type="button">Update user</Button>
      </div>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}

export function PlatformBackupButton({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function backup() {
    setPending(true);
    const response = await fetch("/api/admin/platform-backup", { method: "POST" });
    const result = await response.json().catch(() => null) as { error?: { message?: string }; key?: string } | null;
    setPending(false);
    setMessage(response.ok ? `Uploaded ${result?.key}.` : result?.error?.message ?? "Backup failed.");
  }

  return <div>
    <Button disabled={!configured || pending} onClick={backup} type="button" variant="secondary">
      {pending ? "Uploading…" : "Back up now"}
    </Button>
    {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
  </div>;
}

export function DatabaseResetForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(data: FormData) {
    setPending(true);
    const response = await fetch("/api/admin/database-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation: data.get("confirmation"),
        password: data.get("password"),
      }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setPending(false);
    setMessage(response.ok ? "Platform database reset completed." : result?.error?.message ?? "Reset failed.");
    if (response.ok) {
      router.push("/onboarding");
      router.refresh();
    }
  }

  return (
    <Card className="border-status-danger/40 p-5">
      <h2 className="font-semibold text-status-danger">Reset platform database</h2>
      <p className="mt-2 text-sm text-subdued">Deletes all households, financial data, audit history, and other users. Your current administrator user and session are preserved.</p>
      <form action={submit} className="mt-4 grid gap-3">
        <input className={input} name="confirmation" placeholder="Type RESET PLATFORM DATABASE" required />
        <input autoComplete="current-password" className={input} name="password" placeholder="Current password" required type="password" />
        <Button disabled={pending} type="submit" variant="danger">{pending ? "Resetting…" : "Reset database"}</Button>
      </form>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}
