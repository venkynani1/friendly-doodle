"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, fromLocalInput, toLocalInput } from "@/lib/client";
import type { HrEvent } from "@/lib/types";
import { Button, Field, Input, Notice, cx } from "./ui";

type StagesOption = "ENTRY" | "ENTRY_FOOD" | "ENTRY_FOOD_GOODIES";

const STAGE_OPTIONS: { value: StagesOption; title: string; body: string }[] = [
  { value: "ENTRY", title: "Entry only", body: "Check people in at the door." },
  { value: "ENTRY_FOOD", title: "Entry + food", body: "Also track who collected food." },
  { value: "ENTRY_FOOD_GOODIES", title: "Entry + food + goodies", body: "Track food and goodies counters." },
];

function stagesOf(e?: HrEvent): StagesOption {
  if (!e) return "ENTRY_FOOD";
  if (e.goodiesEnabled) return "ENTRY_FOOD_GOODIES";
  if (e.foodEnabled) return "ENTRY_FOOD";
  return "ENTRY";
}

export default function EventForm({ event }: { event?: HrEvent }) {
  const router = useRouter();
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.endsAt));
  const [capacity, setCapacity] = useState(event?.capacity?.toString() ?? "");
  const [stages, setStages] = useState<StagesOption>(stagesOf(event));
  const [regOpensAt, setRegOpensAt] = useState(toLocalInput(event?.registrationOpensAt));
  const [regClosesAt, setRegClosesAt] = useState(toLocalInput(event?.registrationClosesAt));
  const [walkinsEnabled, setWalkinsEnabled] = useState(event?.walkinsEnabled ?? true);
  const [walkinClosesAt, setWalkinClosesAt] = useState(toLocalInput(event?.walkinClosesAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const start = fromLocalInput(startsAt);
    if (!start) return setError("Set the event start date and time.");
    const cap = capacity.trim() ? Number(capacity) : null;
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) return setError("Capacity must be a whole number above zero, or left empty.");

    setBusy(true);
    try {
      const payload = {
        name,
        description: description || null,
        venue,
        startsAt: start,
        endsAt: fromLocalInput(endsAt),
        capacity: cap,
        stages,
        registrationOpensAt: fromLocalInput(regOpensAt),
        registrationClosesAt: fromLocalInput(regClosesAt),
        walkinsEnabled,
        walkinClosesAt: walkinsEnabled ? fromLocalInput(walkinClosesAt) : null,
      };
      const res = event
        ? await api<{ event: HrEvent }>(`/api/events/${event.id}`, { method: "PUT", json: payload })
        : await api<{ event: HrEvent }>("/api/events", { method: "POST", json: payload });
      router.push(`/admin/events/${res.event.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {error && <Notice tone="bad">{error}</Notice>}

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-bold">About the event</legend>
        <div className="sm:col-span-2">
          <Field label="Event name" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Q4 town hall" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Venue" htmlFor="venue">
            <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} required maxLength={160} placeholder="Block B auditorium, 3rd floor" />
          </Field>
        </div>
        <Field label="Starts" htmlFor="startsAt">
          <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </Field>
        <Field label="Ends" htmlFor="endsAt" hint="Optional">
          <Input id="endsAt" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
        <Field label="Capacity" htmlFor="capacity" hint="Counts registrations and walk-ins together. Leave empty for no limit.">
          <Input id="capacity" type="number" min={1} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes for participants" htmlFor="description" hint="Optional. Shown on the registration page.">
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] focus:border-lanyard focus:outline-none focus:ring-2 focus:ring-lanyard/25"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-lg font-bold">What gets scanned</legend>
        <p className="mb-4 text-[15px] text-muted">Each pass can be scanned once at each counter you pick.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {STAGE_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cx(
                "cursor-pointer rounded-xl border-2 bg-surface p-4 transition-colors",
                stages === o.value ? "border-lanyard" : "border-line hover:border-ink/30",
              )}
            >
              <input type="radio" name="stages" value={o.value} checked={stages === o.value} onChange={() => setStages(o.value)} className="sr-only" />
              <span className="block font-semibold">{o.title}</span>
              <span className="mt-1 block text-sm text-muted">{o.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-1 text-lg font-bold">Registration window</legend>
        <p className="text-[15px] text-muted sm:col-span-2">Leave both empty to accept registrations until you close them.</p>
        <Field label="Opens" htmlFor="regOpens" hint="Optional">
          <Input id="regOpens" type="datetime-local" value={regOpensAt} onChange={(e) => setRegOpensAt(e.target.value)} />
        </Field>
        <Field label="Closes" htmlFor="regCloses" hint="Optional">
          <Input id="regCloses" type="datetime-local" value={regClosesAt} onChange={(e) => setRegClosesAt(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold">Walk-ins</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={walkinsEnabled} onChange={(e) => setWalkinsEnabled(e.target.checked)} className="mt-1 size-5 accent-lanyard" />
          <span>
            <span className="block font-semibold">Allow walk-ins</span>
            <span className="text-[15px] text-muted">You get a separate walk-in link and QR to put up at the venue.</span>
          </span>
        </label>
        {walkinsEnabled && (
          <div className="max-w-sm">
            <Field label="Walk-ins close" htmlFor="walkinCloses" hint="Optional. Otherwise they stay open until you close them.">
              <Input id="walkinCloses" type="datetime-local" value={walkinClosesAt} onChange={(e) => setWalkinClosesAt(e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <Button type="submit" busy={busy}>
          {event ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
