"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Input, Notice, Panel, Select, Spinner, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import type { Role, StaffUser } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { HR_ADMIN: "HR admin", SCANNER_OPERATOR: "Scanner" };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const load = useCallback(() => {
    api<{ staff: StaffUser[] }>("/api/staff")
      .then((r) => setStaff(r.staff))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function toggle(u: StaffUser) {
    setFlash(null);
    try {
      await api(`/api/staff/${u.id}`, { method: "PATCH", json: { active: !u.active } });
      setFlash({ tone: "ok", text: `${u.name} ${u.active ? "can no longer sign in" : "can sign in again"}.` });
      load();
    } catch (e) {
      setFlash({ tone: "bad", text: errorMessage(e) });
    }
  }

  async function resetPassword(u: StaffUser) {
    const password = window.prompt(`New password for ${u.name} (at least 8 characters):`);
    if (!password) return;
    setFlash(null);
    try {
      await api(`/api/staff/${u.id}`, { method: "PATCH", json: { password } });
      setFlash({ tone: "ok", text: `Password changed for ${u.name}.` });
    } catch (e) {
      setFlash({ tone: "bad", text: errorMessage(e) });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Staff</h1>
        <p className="mt-1 text-muted">HR admins manage events. Scanner accounts can only scan passes at the desks.</p>
      </div>

      {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Accounts">
          {error && <Notice tone="bad">{error}</Notice>}
          {!staff && !error && <Spinner />}
          {staff && (
            <ul className="-my-3 divide-y divide-line">
              {staff.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className={cx(!u.active && "opacity-50")}>
                    <div className="font-semibold">
                      {u.name} <span className="font-normal text-muted">· {u.employeeCode}</span>
                    </div>
                    <div className="text-[13px] text-muted">
                      {ROLE_LABEL[u.role]}
                      {!u.active && " · deactivated"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => resetPassword(u)}>
                      Change password
                    </Button>
                    <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => toggle(u)}>
                      {u.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <AddStaff onAdded={(u) => {
          setFlash({ tone: "ok", text: `${u.name} can now sign in with code ${u.employeeCode}.` });
          load();
        }} />
      </div>
    </div>
  );
}

function AddStaff({ onAdded }: { onAdded: (u: StaffUser) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("SCANNER_OPERATOR");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: StaffUser }>("/api/staff", { method: "POST", json: { employeeCode: code, name, role, password } });
      setCode("");
      setName("");
      setPassword("");
      onAdded(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Add an account">
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Employee code" htmlFor="s-code" hint="They sign in with this.">
          <Input id="s-code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="SCAN002" autoCapitalize="characters" />
        </Field>
        <Field label="Name" htmlFor="s-name">
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Role" htmlFor="s-role">
          <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="SCANNER_OPERATOR">Scanner — scans passes only</option>
            <option value="HR_ADMIN">HR admin — full access</option>
          </Select>
        </Field>
        <Field label="Password" htmlFor="s-pass" hint="At least 8 characters. Share it with them directly.">
          <Input id="s-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="off" />
        </Field>
        <Button type="submit" busy={busy}>
          Add account
        </Button>
      </form>
    </Panel>
  );
}
