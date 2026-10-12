"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, Notice, Spinner, StageChip, StatusBadge } from "@/components/ui";
import { api, errorMessage, fmtRange } from "@/lib/client";
import type { HrEvent } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<HrEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ events: HrEvent[] }>("/api/events")
      .then((r) => setEvents(r.events))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const live = events?.filter((e) => e.status !== "COMPLETED") ?? [];
  const done = events?.filter((e) => e.status === "COMPLETED") ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Events</h1>
          <p className="mt-1 text-muted">Create an event, share its link, and track every counter.</p>
        </div>
        <ButtonLink href="/admin/events/new">New event</ButtonLink>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {!events && !error && <Spinner label="Loading events" />}

      {events && events.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-line bg-surface px-6 py-12 text-center">
          <h2 className="text-xl font-bold">No events yet</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">Create your first event to get a registration link you can share with participants.</p>
          <ButtonLink href="/admin/events/new" className="mt-5">
            Create an event
          </ButtonLink>
        </div>
      )}

      {live.length > 0 && <EventList title="Upcoming and live" events={live} />}
      {done.length > 0 && <EventList title="Completed" events={done} />}
    </div>
  );
}

function EventList({ title, events }: { title: string; events: HrEvent[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-muted">{title}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {events.map((e) => {
          const pct = e.capacity ? Math.min(100, Math.round(((e.registeredCount ?? 0) / e.capacity) * 100)) : null;
          return (
            <li key={e.id}>
              <Link href={`/admin/events/${e.id}`} className="grid gap-3 px-5 py-4 hover:bg-canvas/60 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[17px] font-bold">{e.name}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="mt-0.5 text-[15px] text-muted">
                    {fmtRange(e.startsAt, e.endsAt)} · {e.venue}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.stages.map((s) => (
                      <StageChip key={s} stage={s} />
                    ))}
                    {e.walkinsEnabled && <span className="rounded-md bg-canvas px-2 py-0.5 text-[13px] font-semibold text-muted">Walk-ins</span>}
                  </div>
                </div>
                <div className="flex gap-6 text-right tabular-nums">
                  <div>
                    <div className="text-2xl font-extrabold">
                      {e.registeredCount ?? 0}
                      {e.capacity ? <span className="text-base font-semibold text-muted">/{e.capacity}</span> : null}
                    </div>
                    <div className="text-[13px] text-muted">registered</div>
                    {pct !== null && (
                      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full bg-lanyard" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">{e.checkedInCount ?? 0}</div>
                    <div className="text-[13px] text-muted">checked in</div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
