"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage, fmtRange } from "@/lib/client";
import type { HrEvent } from "@/lib/types";

export default function ReportsPage() {
  const [events, setEvents] = useState<HrEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ events: HrEvent[] }>("/api/events")
      .then((r) => setEvents(r.events))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Reports</h1>
        <p className="mt-1 text-muted">Download a CSV per event with every participant and the time of each scan.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      {!events && !error && <Spinner />}
      {events && events.length === 0 && <p className="text-muted">Reports appear here once you create an event.</p>}
      {events && events.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[680px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-3 py-3 text-right font-semibold">Registered</th>
                <th className="px-3 py-3 text-right font-semibold">Checked in</th>
                <th className="px-3 py-3 text-right font-semibold">Attendance</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e) => {
                const reg = e.registeredCount ?? 0;
                const inn = e.checkedInCount ?? 0;
                return (
                  <tr key={e.id}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/events/${e.id}`} className="font-semibold hover:underline">
                        {e.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                        <StatusBadge status={e.status} />
                        {fmtRange(e.startsAt, e.endsAt)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{reg}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{inn}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{reg ? `${Math.round((inn / reg) * 100)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <a href={`/api/events/${e.id}/export`} className="font-semibold text-lanyard hover:underline">
                        Download CSV
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
