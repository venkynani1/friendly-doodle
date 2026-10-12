import type { Stage } from "@prisma/client";
import { prisma } from "./db";
import { ApiError, conflict, isUniqueViolation } from "./api";
import { enabledStages } from "./events";

const STAGE_LABEL: Record<Stage, string> = { ENTRY: "Entry", FOOD: "Food", GOODIES: "Goodies" };

async function loadPass(qrToken: string) {
  const reg = await prisma.registration.findUnique({
    where: { qrToken },
    include: { event: true, scans: { orderBy: { scannedAt: "asc" } } },
  });
  if (!reg) throw new ApiError(404, "INVALID_QR", "This QR code isn't a valid event pass.");
  return reg;
}

function participant(reg: Awaited<ReturnType<typeof loadPass>>) {
  return {
    employeeId: reg.employeeId,
    employeeName: reg.employeeName,
    source: reg.source,
    eventName: reg.event.name,
    stages: enabledStages(reg.event).map((stage) => {
      const s = reg.scans.find((x) => x.stage === stage);
      return { stage, done: Boolean(s), at: s?.scannedAt.toISOString() ?? null, location: s?.locationName ?? null };
    }),
  };
}

function checkEventMatch(reg: Awaited<ReturnType<typeof loadPass>>, eventId?: string | null) {
  if (eventId && reg.eventId !== eventId) {
    throw conflict("WRONG_EVENT", `This pass is for a different event: ${reg.event.name}.`, {
      participant: participant(reg),
    });
  }
}

/** Looks up a pass without recording anything. */
export async function validatePass(qrToken: string, eventId?: string | null) {
  const reg = await loadPass(qrToken);
  checkEventMatch(reg, eventId);
  return { participant: participant(reg), eventStatus: reg.event.status };
}

/** Records a stage scan. The database's unique (registration, stage) key blocks duplicates. */
export async function recordStageScan(opts: {
  qrToken: string;
  stage: Stage;
  locationName?: string | null;
  eventId?: string | null;
  scannedById: string;
}) {
  const reg = await loadPass(opts.qrToken);
  checkEventMatch(reg, opts.eventId);
  const details = { participant: participant(reg) };

  if (reg.event.status !== "OPEN") {
    throw conflict(
      "EVENT_NOT_ACTIVE",
      reg.event.status === "COMPLETED" ? "This event has been completed." : "This event hasn't been opened for scanning yet.",
      details,
    );
  }
  if (!enabledStages(reg.event).includes(opts.stage)) {
    throw conflict("STAGE_DISABLED", `${STAGE_LABEL[opts.stage]} isn't part of this event.`, details);
  }
  if (opts.stage !== "ENTRY" && !reg.scans.some((s) => s.stage === "ENTRY")) {
    throw conflict("NOT_CHECKED_IN", "This person hasn't been checked in at entry yet.", details);
  }

  const previous = reg.scans.find((s) => s.stage === opts.stage);
  const alreadyScanned = (at: Date, location: string | null) =>
    conflict("ALREADY_SCANNED", `${STAGE_LABEL[opts.stage]} already done for this pass.`, {
      ...details,
      previousAt: at.toISOString(),
      previousLocation: location,
    });
  if (previous) throw alreadyScanned(previous.scannedAt, previous.locationName);

  try {
    const scan = await prisma.scan.create({
      data: {
        registrationId: reg.id,
        eventId: reg.eventId,
        stage: opts.stage,
        locationName: opts.locationName || null,
        scannedById: opts.scannedById,
      },
    });
    const fresh = await loadPass(opts.qrToken);
    return {
      result: "ACCEPTED" as const,
      stage: scan.stage,
      scannedAt: scan.scannedAt.toISOString(),
      participant: participant(fresh),
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Another gate scanned this pass a moment ago.
      const other = await prisma.scan.findUnique({
        where: { registrationId_stage: { registrationId: reg.id, stage: opts.stage } },
      });
      throw alreadyScanned(other?.scannedAt ?? new Date(), other?.locationName ?? null);
    }
    throw err;
  }
}
