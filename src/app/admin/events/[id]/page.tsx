"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Input, Notice, Panel, Spinner, StageChip, StatusBadge, cx } from "@/components/ui";
import ParticipantsTable from "@/components/ParticipantsTable";
import { api, errorMessage, fmtDateTime, fmtRange, fromLocalInput, relativeTime, toLocalInput } from "@/lib/client";
import type { Dashboard, HrEvent } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

type Action =
  | "open"
  | "complete"
  | "reopen"
  | "registration-open"
  | "registration-close"
  | "registration-extend"
  | "walkins-open"
  | "walkins-close"
  | "walkins-extend";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<HrEvent | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadDash = useCallback(() => {
    api<Dashboard>(`/api/events/${id}/dashboard`).then(setDash).catch(() => null);
  }, [id]);

  useEffect(() => {
    api<{ event: HrEvent }>(`/api/events/${id}`)
      .then((r) => setEvent(r.event))
      .catch((e) => setError(errorMessage(e)));
    loadDash();
  }, [id, loadDash]);

  // Live counts: refresh every 5s while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadDash();
    }, 5000);
    return () => clearInterval(t);
  }, [loadDash]);

  async function act(action: Action, until?: string | null) {
    setActionError(null);
    setBusyAction(action);
    try {
      const r = await api<{ event: HrEvent }>(`/api/events/${id}/actions`, { method: "POST", json: { action, ...(until ? { until } : {}) } });
      setEvent(r.event);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyAction(null);
    }
  }

  async function remove() {
    if (!event) return;
    const typed = window.prompt(`This deletes the event, all registrations and all scans. Type the event name to confirm:\n\n${event.name}`);
    if (typed === null) return;
    if (typed.trim() !== event.name) {
      setActionError("The name didn't match, so nothing was deleted.");
      return;
    }
    try {
      await api(`/api/events/${id}`, { method: "DELETE" });
      router.replace("/admin");
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!event) return <Spinner label="Loading event" />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-[15px] font-semibold text-lanyard hover:underline">
          Back to events
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold">{event.name}</h1>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-1 text-muted">
              {fmtRange(event.startsAt, event.endsAt)} · {event.venue}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.stages.map((s) => (
                <StageChip key={s} stage={s} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/events/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            {event.status === "DRAFT" && (
              <Button busy={busyAction === "open"} onClick={() => act("open")}>
                Open for scanning
              </Button>
            )}
            {event.status === "OPEN" && (
              <>
                <ButtonLink href={`/scanner?event=${id}`} variant="secondary">
                  Open scanner
                </ButtonLink>
                <Button
                  variant="secondary"
                  busy={busyAction === "complete"}
                  onClick={() => window.confirm("Complete this event? Scanning, registration and walk-ins will stop.") && act("complete")}
                >
                  Complete event
                </Button>
              </>
            )}
            {event.status === "COMPLETED" && (
              <Button variant="secondary" busy={busyAction === "reopen"} onClick={() => act("reopen")}>
                Reopen for scanning
              </Button>
            )}
          </div>
        </div>
      </div>

      {event.status === "DRAFT" && (
        <Notice tone="warn">People can register now, but desks can&apos;t scan until you open the event for scanning.</Notice>
      )}
      {actionError && <Notice tone="bad">{actionError}</Notice>}

      <Metrics event={event} dash={dash} />

      <div className="grid gap-6 lg:grid-cols-2">
        <LinkPanel
          title="Registration link"
          url={event.registrationUrl}
          qrHref={`/api/events/${id}/link-qr?type=registration`}
          state={event.registrationState}
          isOpenFlag={event.registrationOpen}
          closesAt={event.registrationClosesAt}
          opensAt={event.registrationOpensAt}
          completed={event.status === "COMPLETED"}
          busyAction={busyAction}
          onOpen={() => act("registration-open")}
          onClose={() => act("registration-close")}
          onExtend={(until) => act("registration-extend", until)}
          extendAction="registration-extend"
        />
        {event.walkinsEnabled ? (
          <LinkPanel
            title="Walk-in link"
            url={event.walkinUrl}
            qrHref={`/api/events/${id}/link-qr?type=walkin`}
            state={event.walkinState}
            isOpenFlag={event.walkinOpen}
            closesAt={event.walkinClosesAt}
            opensAt={null}
            completed={event.status === "COMPLETED"}
            busyAction={busyAction}
            onOpen={() => act("walkins-open")}
            onClose={() => act("walkins-close")}
            onExtend={(until) => act("walkins-extend", until)}
            extendAction="walkins-extend"
            note="Print this QR and put it up at the venue for people who didn't register."
          />
        ) : (
          <Panel title="Walk-in link">
            <p className="text-muted">Walk-ins are off for this event.</p>
            <ButtonLink href={`/admin/events/${id}/edit`} variant="secondary" className="mt-4">
              Turn on walk-ins
            </ButtonLink>
          </Panel>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ParticipantsTable eventId={id} refreshKey={dash?.registered ?? 0} />
        <Activity dash={dash} />
      </div>

      <div className="border-t border-line pt-6">
        <Button variant="danger" onClick={remove}>
          Delete event
        </Button>
      </div>
    </div>
  );
}

function Metrics({ event, dash }: { event: HrEvent; dash: Dashboard | null }) {
  const items: { label: string; value: number | string; sub?: string; color?: string }[] = [];
  if (dash) {
    items.push({
      label: "Registered",
      value: dash.registered,
      sub: dash.capacity ? `of ${dash.capacity} places` : "no capacity limit",
    });
    items.push({
      label: "Checked in",
      value: dash.checkedIn,
      sub: dash.registered ? `${Math.round((dash.checkedIn / dash.registered) * 100)}% of registered` : undefined,
      color: "var(--color-stage-entry)",
    });
    items.push({ label: "Not yet arrived", value: dash.pending });
    if (event.foodEnabled) items.push({ label: "Food collected", value: dash.food ?? 0, color: "var(--color-stage-food)" });
    if (event.goodiesEnabled) items.push({ label: "Goodies collected", value: dash.goodies ?? 0, color: "var(--color-stage-goodies)" });
    items.push({ label: "Walk-ins", value: dash.walkins, sub: `${dash.normal} pre-registered` });
  }
  return (
    <section aria-label="Live counts">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Live counts</h2>
        {dash && <span className="text-[13px] text-muted">Updates every few seconds</span>}
      </div>
      {!dash ? (
        <Spinner label="Loading counts" />
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {items.map((m) => (
            <div key={m.label} className="bg-surface px-4 py-4">
              <div className="text-[13px] font-semibold text-muted">{m.label}</div>
              <div className="mt-1 font-display text-4xl font-extrabold tabular-nums" style={m.color ? { color: m.color } : undefined}>
                {m.value}
              </div>
              {m.sub && <div className="mt-0.5 text-[13px] text-muted">{m.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LinkPanel(props: {
  title: string;
  url: string;
  qrHref: string;
  state: { open: boolean; reason?: string };
  isOpenFlag: boolean;
  opensAt: string | null;
  closesAt: string | null;
  completed: boolean;
  busyAction: string | null;
  onOpen: () => void;
  onClose: () => void;
  onExtend: (until: string | null) => void;
  extendAction: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [extending, setExtending] = useState(false);
  const [until, setUntil] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", props.url);
    }
  }

  return (
    <Panel
      title={props.title}
      action={
        <span className={cx("rounded-full px-2.5 py-0.5 text-[13px] font-semibold", props.state.open ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
          {props.state.open ? "Accepting sign-ups" : "Closed"}
        </span>
      }
    >
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.qrHref} alt={`QR code for the ${props.title.toLowerCase()}`} className="size-28 shrink-0 rounded-lg border border-line" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-all rounded-lg bg-canvas px-3 py-2 font-mono text-[13px]">{props.url}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copy} className="py-1.5 text-sm">
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={props.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-lanyard hover:bg-lanyard-soft">
              Open
            </a>
            <a href={props.qrHref} download className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-lanyard hover:bg-lanyard-soft">
              Download QR
            </a>
          </div>
        </div>
      </div>

      {props.note && <p className="mt-3 text-sm text-muted">{props.note}</p>}

      <div className="mt-4 space-y-1 border-t border-line pt-4 text-[15px]">
        {!props.state.open && props.state.reason && <p className="font-medium text-bad">{props.state.reason}</p>}
        {props.opensAt && <p className="text-muted">Opens {fmtDateTime(props.opensAt)}</p>}
        <p className="text-muted">{props.closesAt ? `Closes ${fmtDateTime(props.closesAt)}` : "No closing time — stays open until you close it."}</p>
      </div>

      {!props.completed && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {props.isOpenFlag && props.state.open ? (
            <Button variant="secondary" busy={props.busyAction?.endsWith("close")} onClick={props.onClose}>
              Close now
            </Button>
          ) : (
            <Button variant="secondary" busy={props.busyAction?.endsWith("-open")} onClick={props.onOpen}>
              Reopen
            </Button>
          )}
          <Button variant="ghost" onClick={() => setExtending((v) => !v)}>
            {extending ? "Cancel" : "Set closing time"}
          </Button>
        </div>
      )}
      {extending && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            props.onExtend(fromLocalInput(until));
            setExtending(false);
          }}
        >
          <label className="flex-1 text-sm font-semibold">
            Keep open until
            <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} required className="mt-1" />
          </label>
          <Button type="submit" busy={props.busyAction === props.extendAction}>
            Save
          </Button>
        </form>
      )}
    </Panel>
  );
}

function Activity({ dash }: { dash: Dashboard | null }) {
  return (
    <Panel title="Recent activity">
      {!dash ? (
        <Spinner />
      ) : dash.activity.length === 0 ? (
        <p className="text-muted">Registrations and scans will appear here as they happen.</p>
      ) : (
        <ol className="space-y-3">
          {dash.activity.map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex gap-3 text-[15px]">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    a.kind === "REGISTRATION"
                      ? "var(--color-line)"
                      : a.stage === "FOOD"
                        ? "var(--color-stage-food)"
                        : a.stage === "GOODIES"
                          ? "var(--color-stage-goodies)"
                          : "var(--color-stage-entry)",
                }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-semibold">{a.employeeName}</span>{" "}
                  {a.kind === "REGISTRATION" ? (a.by === "Walk-in" ? "registered as a walk-in" : "registered") : `${STAGE_LABEL[a.stage!].toLowerCase()} scanned`}
                </p>
                <p className="text-[13px] text-muted">
                  {relativeTime(a.at)}
                  {a.location ? ` · ${a.location}` : ""}
                  {a.kind === "SCAN" && a.by ? ` · by ${a.by}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
