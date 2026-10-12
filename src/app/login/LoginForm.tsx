"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import type { Role } from "@/lib/types";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: { role: Role } }>("/api/auth/login", {
        method: "POST",
        json: { employeeCode: code, password },
      });
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      const fallback = user.role === "HR_ADMIN" ? "/admin" : "/scanner";
      const target = safeNext && (user.role === "HR_ADMIN" || safeNext.startsWith("/scanner")) ? safeNext : fallback;
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <div>
        <p className="text-sm font-semibold text-lanyard md:hidden">Maverick Event Control Hub</p>
        <h2 className="mt-1 text-3xl font-extrabold">Sign in</h2>
        <p className="mt-1 text-muted">Use the employee code and password HR gave you.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <Field label="Employee code" htmlFor="code">
        <Input id="code" autoComplete="username" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" busy={busy} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
