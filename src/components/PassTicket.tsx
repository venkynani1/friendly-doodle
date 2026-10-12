"use client";

import { useState } from "react";
import { fmtRange } from "@/lib/client";
import type { Pass } from "@/lib/types";

/** The participant's pass, styled as a tear-off event ticket. */
export default function PassTicket({ pass }: { pass: Pass }) {
  const [copied, setCopied] = useState(false);
  const qrSrc = `/api/public/pass/${encodeURIComponent(pass.qrToken)}/qr`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(pass.qrToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your token:", pass.qrToken);
    }
  }

  return (
    <article className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_var(--color-line),0_12px_32px_-12px_rgba(23,32,46,0.25)]">
      <header className="bg-lanyard px-6 pb-5 pt-6 text-white">
        <p className="text-sm text-white/80">{pass.source === "WALKIN" ? "Walk-in pass" : "Event pass"}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{pass.event.name}</h1>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-6 py-5 text-[15px]">
        <dt className="text-muted">When</dt>
        <dd className="font-medium">{fmtRange(pass.event.startsAt, pass.event.endsAt)}</dd>
        <dt className="text-muted">Where</dt>
        <dd className="font-medium">{pass.event.venue}</dd>
        <dt className="text-muted">Name</dt>
        <dd className="font-medium">{pass.employeeName}</dd>
        <dt className="text-muted">Employee ID</dt>
        <dd className="font-medium">{pass.employeeId}</dd>
      </dl>

      <div className="ticket-perforation" aria-hidden />

      <div className="flex flex-col items-center px-6 pb-6 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="Your entry QR code" width={240} height={240} className="size-60" />
        <p className="mt-3 text-center text-sm text-muted">Show this at the entry desk. If the camera can&apos;t read it, read out the token below.</p>
        <p className="mt-2 select-all break-all rounded-lg bg-canvas px-3 py-2 text-center font-mono text-[15px] tracking-wide">{pass.qrToken}</p>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <button onClick={copy} className="rounded-lg border border-line px-3 py-2.5 text-[15px] font-semibold hover:border-ink/40">
            {copied ? "Copied" : "Copy token"}
          </button>
          <a href={`${qrSrc}?download=1`} className="rounded-lg bg-ink px-3 py-2.5 text-center text-[15px] font-semibold text-white hover:bg-ink/85">
            Download QR
          </a>
        </div>
      </div>
    </article>
  );
}
