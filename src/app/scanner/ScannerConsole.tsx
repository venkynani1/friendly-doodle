"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Notice, Select, Spinner, StageChip, cx, stageColor } from "@/components/ui";
import { api, ClientError, errorMessage, fmtTime } from "@/lib/client";
import type { Dashboard, HrEvent, ScanParticipant, Stage } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

type Verdict =
  | { kind: "ok"; stage: Stage; participant: ScanParticipant; at: string }
  | { kind: "repeat"; stage: Stage; message: string; participant?: ScanParticipant; previousAt?: string; previousLocation?: string | null }
  | { kind: "bad"; message: string; participant?: ScanParticipant };

type LogItem = { id: number; at: string; name: string; stage: Stage; ok: boolean; note: string };

const LOCATION_KEY = "ech_scanner_location";
const SAME_CODE_COOLDOWN_MS = 4000;

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
    o.onended = () => ctx.close();
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 60, 80]);
  } catch {
    /* audio is a nice-to-have */
  }
}

export default function ScannerConsole() {
  const params = useSearchParams();
  const [events, setEvents] = useState<HrEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>("");
  const [stage, setStage] = useState<Stage>("ENTRY");
  const [location, setLocation] = useState("");
  const [manual, setManual] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const logId = useRef(0);

  // Keep the latest choices readable from inside the camera callback.
  const ctxRef = useRef({ eventId, stage, location });
  ctxRef.current = { eventId, stage, location };

  const event = events?.find((e) => e.id === eventId) ?? null;

  useEffect(() => {
    try {
      setLocation(window.localStorage.getItem(LOCATION_KEY) ?? "");
    } catch {
      /* ignore */
    }
    api<{ events: HrEvent[] }>("/api/events")
      .then((r) => {
        const open = r.events.filter((e) => e.status === "OPEN");
        setEvents(open);
        const wanted = params.get("event");
        const pick = open.find((e) => e.id === wanted) ?? (open.length === 1 ? open[0] : undefined);
        if (pick) setEventId(pick.id);
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [params]);

  // If the chosen stage isn't part of this event, fall back to entry.
  useEffect(() => {
    if (event && !event.stages.includes(stage)) setStage("ENTRY");
  }, [event, stage]);

  const loadDash = useCallback(() => {
    if (!eventId) return;
    api<Dashboard>(`/api/events/${eventId}/dashboard`).then(setDash).catch(() => null);
  }, [eventId]);

  useEffect(() => {
    setDash(null);
    loadDash();
    const t = setInterval(() => document.visibilityState === "visible" && loadDash(), 5000);
    return () => clearInterval(t);
  }, [loadDash]);

  const submit = useCallback(
    async (rawToken: string) => {
      const qrToken = rawToken.trim();
      const { eventId: evId, stage: st, location: loc } = ctxRef.current;
      if (!qrToken || busyRef.current) return;
      if (!evId) {
        setVerdict({ kind: "bad", message: "Pick the event you're scanning for first." });
        return;
      }
      busyRef.current = true;
      setSubmitting(true);
      try {
        const r = await api<{ stage: Stage; scannedAt: string; participant: ScanParticipant }>("/api/scan/stage", {
          method: "POST",
          json: { qrToken, stage: st, locationName: loc || null, eventId: evId },
        });
        setVerdict({ kind: "ok", stage: r.stage, participant: r.participant, at: r.scannedAt });
        beep(true);
        setLog((l) => [{ id: ++logId.current, at: r.scannedAt, name: r.participant.employeeName, stage: r.stage, ok: true, note: "Accepted" }, ...l].slice(0, 30));
        setManual("");
        loadDash();
      } catch (err) {
        beep(false);
        const details = err instanceof ClientError ? err.details : undefined;
        const participant = details?.participant as ScanParticipant | undefined;
        if (err instanceof ClientError && err.code === "ALREADY_SCANNED") {
          setVerdict({
            kind: "repeat",
            stage: st,
            message: err.message,
            participant,
            previousAt: details?.previousAt as string | undefined,
            previousLocation: details?.previousLocation as string | null | undefined,
          });
        } else {
          setVerdict({ kind: "bad", message: errorMessage(err), participant });
        }
        setLog((l) =>
          [{ id: ++logId.current, at: new Date().toISOString(), name: participant?.employeeName ?? "Unknown pass", stage: st, ok: false, note: errorMessage(err) }, ...l].slice(0, 30),
        );
      } finally {
        busyRef.current = false;
        setSubmitting(false);
      }
    },
    [loadDash],
  );

  const onDecode = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastCode.current && lastCode.current.code === text && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return;
      lastCode.current = { code: text, at: now };
      void submit(text);
    },
    [submit],
  );

  async function startCamera() {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onDecode, () => {});
      scannerRef.current = scanner;
      setCameraOn(true);
    } catch (err) {
      const msg = errorMessage(err);
      setCameraError(
        /permission|notallowed/i.test(msg)
          ? "Camera access was blocked. Allow the camera for this site in your browser settings, then try again."
          : /secure|https/i.test(msg)
            ? "The camera only works over HTTPS. Open this page from the https:// address."
            : `Couldn't start the camera: ${msg}`,
      );
    }
  }

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setCameraOn(false);
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(() => () => void stopCamera(), [stopCamera]);

  function saveLocation(v: string) {
    setLocation(v);
    try {
      window.localStorage.setItem(LOCATION_KEY, v);
    } catch {
      /* ignore */
    }
  }

  if (loadError) return <Notice tone="bad">{loadError}</Notice>;
  if (!events) return <Spinner label="Loading events" />;
  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center">
        <h1 className="text-xl font-bold">No events are open for scanning</h1>
        <p className="mt-2 text-muted">Ask HR to open the event for scanning, then reload this page.</p>
        <Button variant="secondary" className="mt-5" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {/* Setup */}
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <label className="text-sm font-semibold">
            Event
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)} className="mt-1">
              <option value="">Choose an event…</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-semibold">
            Desk name
            <Input value={location} onChange={(e) => saveLocation(e.target.value)} placeholder="Gate A" maxLength={80} className="mt-1" />
          </label>
        </div>

        {event && (
          <div role="radiogroup" aria-label="Counter" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${event.stages.length}, minmax(0, 1fr))` }}>
            {event.stages.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={stage === s}
                onClick={() => setStage(s)}
                className={cx("rounded-xl border-2 px-3 py-3 text-lg font-extrabold transition-colors", stage === s ? "text-white" : "bg-surface text-ink")}
                style={stage === s ? { background: stageColor[s], borderColor: stageColor[s] } : { borderColor: "var(--color-line)" }}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        {/* Verdict: the thing the desk looks at */}
        <VerdictPanel verdict={verdict} stage={stage} submitting={submitting} />

        {/* Camera */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div id="qr-reader" className={cx("w-full", !cameraOn && "hidden")} />
          {!cameraOn && (
            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <p className="text-muted">Point the camera at a participant&apos;s QR pass. Scans are recorded instantly.</p>
              <Button onClick={startCamera} disabled={!eventId} className="px-6 py-3 text-base">
                Start camera
              </Button>
              {!eventId && <p className="text-[13px] text-muted">Choose an event first.</p>}
            </div>
          )}
          {cameraOn && (
            <div className="flex justify-end border-t border-line p-2">
              <Button variant="ghost" onClick={stopCamera}>
                Stop camera
              </Button>
            </div>
          )}
        </div>
        {cameraError && <Notice tone="bad">{cameraError}</Notice>}

        {/* Manual entry */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(manual);
          }}
          className="flex gap-2"
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or type the token, e.g. 7KQ2M-XB9RT-…"
            aria-label="QR token"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono"
          />
          <Button type="submit" busy={submitting} disabled={!manual.trim() || !eventId}>
            Record
          </Button>
        </form>
      </div>

      {/* Side: live counts and this desk's history */}
      <aside className="space-y-5">
        {event && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-base font-bold">{event.name}</h2>
            {!dash ? (
              <Spinner label="Loading counts" />
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 tabular-nums">
                <Count label="Checked in" value={`${dash.checkedIn}/${dash.registered}`} color={stageColor.ENTRY} />
                {dash.food !== null && <Count label="Food" value={String(dash.food)} color={stageColor.FOOD} />}
                {dash.goodies !== null && <Count label="Goodies" value={String(dash.goodies)} color={stageColor.GOODIES} />}
                <Count label="Walk-ins" value={String(dash.walkins)} />
              </dl>
            )}
          </section>
        )}
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-base font-bold">This desk</h2>
          {log.length === 0 ? (
            <p className="mt-2 text-[15px] text-muted">Scans from this screen will be listed here.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {log.map((l) => (
                <li key={l.id} className="flex items-start gap-2.5 text-[15px]">
                  <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", l.ok ? "bg-ok" : "bg-bad")} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="text-[13px] text-muted">
                      {fmtTime(l.at)} · {STAGE_LABEL[l.stage]} · {l.note}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

function Count({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-extrabold" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}

function VerdictPanel({ verdict, stage, submitting }: { verdict: Verdict | null; stage: Stage; submitting: boolean }) {
  if (submitting && !verdict) {
    return (
      <div className="rounded-xl bg-surface px-5 py-6">
        <Spinner label="Checking pass" />
      </div>
    );
  }
  if (!verdict) {
    return (
      <div className="rounded-xl border-2 border-dashed border-line px-5 py-6 text-center text-muted">
        Ready to scan for <span className="font-bold" style={{ color: stageColor[stage] }}>{STAGE_LABEL[stage]}</span>
      </div>
    );
  }

  const tone =
    verdict.kind === "ok"
      ? { bg: "var(--color-ok)", title: `${STAGE_LABEL[verdict.stage]} recorded` }
      : verdict.kind === "repeat"
        ? { bg: "var(--color-warn)", title: "Already scanned" }
        : { bg: "var(--color-bad)", title: "Not accepted" };
  const p = verdict.participant;

  return (
    <div key={JSON.stringify(verdict)} className="verdict-in overflow-hidden rounded-xl text-white" style={{ background: tone.bg }} role="status" aria-live="assertive">
      <div className="px-5 py-5">
        <p className="font-display text-3xl font-extrabold">{tone.title}</p>
        {p && (
          <p className="mt-1 text-xl font-semibold">
            {p.employeeName} <span className="font-normal opacity-85">· {p.employeeId}</span>
            {p.source === "WALKIN" && <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-sm">Walk-in</span>}
          </p>
        )}
        {verdict.kind === "repeat" && (
          <p className="mt-2 text-[15px] opacity-95">
            First scanned at {fmtTime(verdict.previousAt)}
            {verdict.previousLocation ? ` at ${verdict.previousLocation}` : ""}. Don&apos;t hand out a second time.
          </p>
        )}
        {verdict.kind === "bad" && <p className="mt-2 text-[15px] opacity-95">{verdict.message}</p>}
      </div>
      {p && (
        <div className="flex flex-wrap gap-1.5 bg-black/15 px-5 py-2.5">
          {p.stages.map((s) => (
            <span key={s.stage} className="rounded-md bg-white px-0.5">
              <StageChip stage={s.stage} done={s.done} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
