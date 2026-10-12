"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import EventForm from "@/components/EventForm";
import { Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import type { HrEvent } from "@/lib/types";

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<HrEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ event: HrEvent }>(`/api/events/${id}`)
      .then((r) => setEvent(r.event))
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/admin/events/${id}`} className="text-[15px] font-semibold text-lanyard hover:underline">
        Back to event
      </Link>
      <h1 className="mb-8 mt-2 text-3xl font-extrabold">Edit event</h1>
      {error && <Notice tone="bad">{error}</Notice>}
      {!event && !error && <Spinner />}
      {event && (
        <>
          <Notice tone="warn" className="mb-6">
            If people have already registered, changing the time or venue won&apos;t re-send their passes. Let them know separately.
          </Notice>
          <EventForm event={event} />
        </>
      )}
    </div>
  );
}
