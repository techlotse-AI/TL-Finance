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
  failedLoginCount?: number;
  locked?: boolean;
  lockedUntil?: string | null;
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
    setMessage(null);
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

  async function unlock() {
    const response = await fetch("/api/admin/users/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedId }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setMessage(response.ok ? "Account unlocked." : result?.error?.message ?? "Unlock failed.");
    if (response.ok) router.refresh();
  }

  async function resetTotp() {
    const response = await fetch("/api/admin/users/reset-totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedId }),
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setMessage(response.ok
      ? "Two-factor authentication reset. The user signs in with password only and can re-enroll."
      : result?.error?.message ?? "Reset failed.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">User management</h2>
      <div className="mt-4 grid gap-3">
        <select className={input} onChange={(event) => selectUser(event.target.value)} value={selectedId}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.locked ? `${user.email} (locked)` : user.email}</option>
          ))}
        </select>
        {selected?.locked ? (
          <p className="rounded border border-status-warning/40 bg-status-warning/5 px-3 py-2 text-sm text-status-warning" role="status">
            Account locked after {selected.failedLoginCount ?? 0} failed sign-ins
            {selected.lockedUntil ? ` until ${new Date(selected.lockedUntil).toLocaleString()}` : ""}. It will auto-unlock, or unlock it now.
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-subdued"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> Active</label>
        <label className="flex items-center gap-2 text-sm text-subdued"><input checked={instanceAdmin} onChange={(event) => setInstanceAdmin(event.target.checked)} type="checkbox" /> Instance administrator</label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!selectedId} onClick={submit} type="button">Update user</Button>
          <Button disabled={!selectedId || !selected?.locked} onClick={unlock} type="button" variant="secondary">Unlock account</Button>
          <Button disabled={!selectedId} onClick={resetTotp} type="button" variant="secondary" title="Recovery path when a user loses their authenticator and recovery codes">Reset 2FA</Button>
        </div>
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

interface HouseholdSummary {
  id: string;
  name: string;
  members: Array<{ userId: string; email: string; role: string }>;
}

export function HouseholdMembershipForm({
  households,
  users,
}: {
  households: HouseholdSummary[];
  users: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? "");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [role, setRole] = useState("member");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const household = households.find((candidate) => candidate.id === householdId);

  async function assign() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/admin/household-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId, userId, role }),
    });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    setPending(false);
    setMessage(response.ok ? "Member assigned." : result?.error?.message ?? "Assign failed.");
    if (response.ok) router.refresh();
  }

  async function remove(targetUserId: string) {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/admin/household-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId, userId: targetUserId }),
    });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    setPending(false);
    setMessage(response.ok ? "Member removed." : result?.error?.message ?? "Remove failed.");
    if (response.ok) router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Household membership</h2>
      <p className="mt-2 text-sm text-subdued">Assign any user to any household, or remove them. The household owner cannot be removed here.</p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm text-subdued">Household<select className={input} onChange={(event) => setHouseholdId(event.target.value)} value={householdId}>
          {households.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select></label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="grid gap-1 text-sm text-subdued">User<select className={input} onChange={(event) => setUserId(event.target.value)} value={userId}>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select></label>
          <label className="grid gap-1 text-sm text-subdued">Role<select className={input} onChange={(event) => setRole(event.target.value)} value={role}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select></label>
        </div>
        <Button disabled={pending || !householdId || !userId} onClick={assign} type="button">Assign to household</Button>
      </div>
      {household && household.members.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-subdued"><th className="py-1">Member</th><th>Role</th><th /></tr></thead>
            <tbody>
              {household.members.map((member) => (
                <tr key={member.userId} className="border-t">
                  <td className="py-1">{member.email}</td>
                  <td>{member.role}</td>
                  <td className="text-right">
                    {member.role === "owner" ? (
                      <span className="text-xs text-subdued">owner</span>
                    ) : (
                      <Button disabled={pending} onClick={() => remove(member.userId)} type="button" variant="danger">Remove</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}

export function PasswordResetForm({ users }: { users: Array<{ id: string; email: string; instanceAdmin: boolean }> }) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [bulk, setBulk] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setMessage(null);
    const body = bulk ? { allNonAdmin: true, newPassword: password } : { userId, newPassword: password };
    const response = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as { error?: { message?: string }; count?: number } | null;
    setPending(false);
    if (!response.ok) {
      setMessage(result?.error?.message ?? "Reset failed.");
      return;
    }
    setPassword("");
    setMessage(bulk ? `Temporary password set for ${result?.count ?? 0} user(s). Share it securely; they must change it.` : "Temporary password set. Share it securely with the user.");
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Reset user password</h2>
      <p className="mt-2 text-sm text-subdued">Sets a temporary password (min 12 chars, with upper, lower, and a number) and signs the affected users out of all sessions.</p>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-2 text-sm text-subdued"><input checked={bulk} onChange={(event) => setBulk(event.target.checked)} type="checkbox" /> Reset all non-administrator users</label>
        {!bulk ? (
          <label className="grid gap-1 text-sm text-subdued">User<select className={input} onChange={(event) => setUserId(event.target.value)} value={userId}>
            {users.map((user) => <option key={user.id} value={user.id}>{user.instanceAdmin ? `${user.email} (admin)` : user.email}</option>)}
          </select></label>
        ) : null}
        <label className="grid gap-1 text-sm text-subdued">Temporary password<input autoComplete="new-password" className={input} onChange={(event) => setPassword(event.target.value)} type="text" value={password} placeholder="e.g. Welcome2026!" /></label>
        <Button disabled={pending || password.length < 12 || (!bulk && !userId)} onClick={submit} type="button" variant={bulk ? "danger" : "primary"}>
          {pending ? "Resetting…" : bulk ? "Reset all non-admin passwords" : "Set temporary password"}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-subdued" role="status">{message}</p> : null}
    </Card>
  );
}
