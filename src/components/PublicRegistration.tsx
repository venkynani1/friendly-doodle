"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage, fmtDateTime, fmtRange } from "@/lib/client";
import type { Pass, PublicEvent } from "@/lib/types";
import { Button, Field, Input, Notice, Spinner } from "./ui";
import PassTicket from "./PassTicket";

const DEVICE_KEY = "ech_device";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function deviceToken(): string | null {
  const s = storage();
  if (!s) return null;
  let t = s.getItem(DEVICE_KEY);
  if (!t) {
    t = crypto.randomUUID();
    try {
      s.setItem(DEVICE_KEY, t);
    } catch {
      return null;
    }
  }
  return t;
}

export default function PublicRegistration({ slug, kind }: { slug: string; kind: "NORMAL" | "WALKIN" }) {
  const base = kind === "NORMAL" ? `/api/public/events/${slug}` : `/api/public/walkins/${slug}`;
  const passKey = `ech_pass_${kind}_${slug}`;

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [pass, setPass] = useState<Pass | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);

  useEffect(() => {
    setSavedToken(storage()?.getItem(passKey) ?? null);
    api<{ event: PublicEvent }>(base)
      .then((r) => setEvent(r.event))
      .catch((e) => setLoadError(errorMessage(e)));
  }, [base, passKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ pass: Pass }>(`${base}/register`, {
        method: "POST",
        json: { employeeId, employeeName, employeeEmail, deviceToken: deviceToken() },
      });
      try {
        storage()?.setItem(passKey, r.pass.qrToken);
      } catch {
        /* storage full or blocked: the pass is still emailed */
      }
      setPass(r.pass);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (pass) {
    return (
      <Frame>
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-extrabold">You&apos;re registered</h2>
          <p className="mt-1 text-muted">
            {pass.emailStatus === "SENT"
              ? `We've also emailed this pass to ${pass.employeeEmail}.`
              : pass.emailStatus === "FAILED"
                ? "We couldn't email your pass, so download the QR or save the token now."
                : "Save this pass: download the QR or note the token."}
          </p>
        </div>
        <PassTicket pass={pass} />
      </Frame>
    );
  }

  if (loadError) {
    return (
      <Frame>
        <Notice tone="bad">{loadError}</Notice>
        <p className="mt-4 text-muted">Check that you opened the full link you were sent, or ask the event organiser for a new one.</p>
      </Frame>
    );
  }

  if (!event) {
    return (
      <Frame>
        <Spinner label="Loading event" />
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="mb-6">
        <p className="text-sm font-semibold text-lanyard">{kind === "WALKIN" ? "Walk-in registration" : "Event registration"}</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight">{event.name}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {fmtRange(event.startsAt, event.endsAt)}
          <br />
          {event.venue}
        </p>
        {event.description && <p className="mt-3 whitespace-pre-line text-[15px]">{event.description}</p>}
      </header>

      {savedToken && (
        <Notice tone="info" className="mb-5">
          You&apos;ve registered from this device already.{" "}
          <Link href={`/pass/${savedToken}`} className="font-bold underline">
            Open your pass
          </Link>
        </Notice>
      )}

      {!event.open ? (
        <Notice tone="warn">{event.closedReason ?? "Registration is closed."}</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface p-5 sm:p-6">
          {error && <Notice tone="bad">{error.message}</Notice>}
          <Field label="Employee ID" htmlFor="employeeId">
            <Input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required maxLength={40} autoCapitalize="characters" autoComplete="off" />
          </Field>
          <Field label="Full name" htmlFor="employeeName">
            <Input id="employeeName" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required maxLength={120} autoComplete="name" />
          </Field>
          <Field label="Work email" htmlFor="employeeEmail" hint="Your pass is emailed here.">
            <Input id="employeeEmail" type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} required maxLength={200} autoComplete="email" inputMode="email" />
          </Field>
          <Button type="submit" busy={busy} className="w-full py-3 text-base">
            {busy ? "Creating your pass" : "Get my pass"}
          </Button>
          {event.closesAt && <p className="text-center text-[13px] text-muted">Registration closes {fmtDateTime(event.closesAt)}.</p>}
        </form>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8 sm:py-12">
      {children}
      <p className="mt-10 text-center text-[13px] text-muted">Maverick Event Control Hub</p>
    </main>
  );
}
