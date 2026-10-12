"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, fmtDateTime, fmtTime } from "@/lib/client";
import type { Source, Stage } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import { Input, Notice, Panel, Select, Spinner, stageColor } from "./ui";

type Row = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  source: Source;
  registeredAt: string;
  emailStatus: "PENDING" | "SENT" | "LOGGED" | "FAILED";
  emailError: string | null;
  scans: Partial<Record<Stage, string | null>>;
};

const EMAIL_LABEL = { PENDING: "Sending", SENT: "Sent", LOGGED: "Not sent (email off)", FAILED: "Failed" } as const;

export default function ParticipantsTable({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [data, setData] = useState<{ total: number; stages: Stage[]; registrations: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (source) params.set("source", source);
    api<{ total: number; stages: Stage[]; registrations: Row[] }>(`/api/events/${eventId}/registrations?${params}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [eventId, q, source]);

  // Debounced search; also reloads when the live registered count changes.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  async function resend(row: Row) {
    setResending(row.id);
    setFlash(null);
    try {
      const r = await api<{ status: string; error?: string }>(`/api/registrations/${row.id}/resend`, { method: "POST" });
      setFlash(
        r.status === "SENT"
          ? `Pass emailed to ${row.employeeEmail}.`
          : r.status === "LOGGED"
            ? "Email isn't set up on the server yet, so the pass was written to the server log instead."
            : `Couldn't send: ${r.error ?? "unknown error"}`,
      );
      load();
    } catch (e) {
      setFlash(errorMessage(e));
    } finally {
      setResending(null);
    }
  }

  return (
    <Panel
      title="Participants"
      action={
        <a href={`/api/events/${eventId}/export`} className="rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink/85">
          Download CSV
        </a>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="search"
          placeholder="Search name, employee ID or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1"
          aria-label="Search participants"
        />
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-auto" aria-label="Filter by registration type">
          <option value="">Everyone</option>
          <option value="NORMAL">Pre-registered</option>
          <option value="WALKIN">Walk-ins</option>
        </Select>
      </div>
      {flash && (
        <Notice tone="info" className="mb-4">
          {flash}
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      {!data && !error && <Spinner />}
      {data && data.registrations.length === 0 && (
        <p className="py-6 text-center text-muted">{q || source ? "Nobody matches that search." : "No one has registered yet. Share the registration link to get started."}</p>
      )}
      {data && data.registrations.length > 0 && (
        <>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-2 font-semibold">Participant</th>
                  {data.stages.map((s) => (
                    <th key={s} className="px-3 py-2 font-semibold">
                      {STAGE_LABEL[s]}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">Pass email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.registrations.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-semibold">
                        {r.employeeName}
                        {r.source === "WALKIN" && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[12px] font-semibold text-muted">Walk-in</span>}
                      </div>
                      <div className="text-[13px] text-muted">
                        {r.employeeId} · {r.employeeEmail}
                      </div>
                      <div className="text-[13px] text-muted">Registered {fmtDateTime(r.registeredAt)}</div>
                    </td>
                    {data.stages.map((s) => (
                      <td key={s} className="whitespace-nowrap px-3 py-3 tabular-nums">
                        {r.scans[s] ? (
                          <span className="font-semibold" style={{ color: stageColor[s] }}>
                            {fmtTime(r.scans[s])}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      <div className={r.emailStatus === "FAILED" ? "font-semibold text-bad" : "text-muted"} title={r.emailError ?? undefined}>
                        {EMAIL_LABEL[r.emailStatus]}
                      </div>
                      <button
                        onClick={() => resend(r)}
                        disabled={resending === r.id}
                        className="text-[13px] font-semibold text-lanyard hover:underline disabled:text-muted"
                      >
                        {resending === r.id ? "Sending…" : "Resend"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.registrations.length && (
            <p className="mt-3 text-[13px] text-muted">
              Showing {data.registrations.length} of {data.total}. Search to narrow it down, or download the CSV for everyone.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
