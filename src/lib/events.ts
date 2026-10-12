import type { Event, Registration, RegistrationSource, Stage } from "@prisma/client";
import { prisma } from "./db";
import { ApiError, conflict, isUniqueViolation, notFound, uniqueTarget } from "./api";
import { newQrToken } from "./tokens";
import { sendPassEmail } from "./email";
import type { RegistrationInput } from "./validation";

// ---------------------------------------------------------------------------
// Registration windows
// ---------------------------------------------------------------------------

export type WindowState = { open: boolean; reason?: string };

export function registrationState(e: Event, now = new Date()): WindowState {
  if (e.status === "COMPLETED") return { open: false, reason: "This event has ended." };
  if (!e.registrationOpen) return { open: false, reason: "Registration is closed." };
  if (e.registrationOpensAt && now < e.registrationOpensAt)
    return { open: false, reason: "Registration hasn't opened yet." };
  if (e.registrationClosesAt && now > e.registrationClosesAt)
    return { open: false, reason: "Registration has closed." };
  return { open: true };
}

export function walkinState(e: Event, now = new Date()): WindowState {
  if (!e.walkinsEnabled) return { open: false, reason: "Walk-ins aren't available for this event." };
  if (e.status === "COMPLETED") return { open: false, reason: "This event has ended." };
  if (!e.walkinOpen) return { open: false, reason: "Walk-ins are closed." };
  if (e.walkinClosesAt && now > e.walkinClosesAt) return { open: false, reason: "Walk-ins have closed." };
  return { open: true };
}

export function enabledStages(e: Pick<Event, "foodEnabled" | "goodiesEnabled">): Stage[] {
  const stages: Stage[] = ["ENTRY"];
  if (e.foodEnabled) stages.push("FOOD");
  if (e.goodiesEnabled) stages.push("GOODIES");
  return stages;
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function hrEvent(e: Event, baseUrl: string) {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    venue: e.venue,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    capacity: e.capacity,
    status: e.status,
    foodEnabled: e.foodEnabled,
    goodiesEnabled: e.goodiesEnabled,
    stages: enabledStages(e),
    registrationSlug: e.registrationSlug,
    registrationOpen: e.registrationOpen,
    registrationOpensAt: e.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: e.registrationClosesAt?.toISOString() ?? null,
    registrationState: registrationState(e),
    walkinsEnabled: e.walkinsEnabled,
    walkinSlug: e.walkinSlug,
    walkinOpen: e.walkinOpen,
    walkinClosesAt: e.walkinClosesAt?.toISOString() ?? null,
    walkinState: walkinState(e),
    registrationUrl: `${baseUrl}/register/${e.registrationSlug}`,
    walkinUrl: `${baseUrl}/walkin/${e.walkinSlug}`,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export type HrEvent = ReturnType<typeof hrEvent>;

export function publicEvent(e: Event, kind: "NORMAL" | "WALKIN") {
  const state = kind === "NORMAL" ? registrationState(e) : walkinState(e);
  return {
    name: e.name,
    description: e.description,
    venue: e.venue,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    kind,
    open: state.open,
    closedReason: state.reason ?? null,
    closesAt: (kind === "NORMAL" ? e.registrationClosesAt : e.walkinClosesAt)?.toISOString() ?? null,
  };
}

export function passView(r: Registration & { event: Event }) {
  return {
    qrToken: r.qrToken,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeEmail: r.employeeEmail,
    source: r.source,
    registeredAt: r.createdAt.toISOString(),
    emailStatus: r.emailStatus,
    event: {
      name: r.event.name,
      venue: r.event.venue,
      startsAt: r.event.startsAt.toISOString(),
      endsAt: r.event.endsAt?.toISOString() ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function duplicateMessage(err: unknown): ApiError {
  const target = uniqueTarget(err).join(",");
  if (target.includes("employeeId"))
    return conflict("DUPLICATE_EMPLOYEE", "This employee ID is already registered for this event.");
  if (target.includes("employeeEmail"))
    return conflict("DUPLICATE_EMAIL", "This email is already registered for this event.");
  if (target.includes("deviceToken"))
    return conflict(
      "DUPLICATE_DEVICE",
      "This device has already been used to register for this event. Check your email for your pass.",
    );
  return conflict("DUPLICATE", "You're already registered for this event.");
}

export async function registerParticipant(opts: {
  slug: string;
  source: RegistrationSource;
  input: RegistrationInput;
  baseUrl: string;
}) {
  const { slug, source, input, baseUrl } = opts;
  const event =
    source === "NORMAL"
      ? await prisma.event.findUnique({ where: { registrationSlug: slug } })
      : await prisma.event.findUnique({ where: { walkinSlug: slug } });
  if (!event) throw notFound("This registration link isn't valid.");

  const state = source === "NORMAL" ? registrationState(event) : walkinState(event);
  if (!state.open) throw conflict("REGISTRATION_CLOSED", state.reason ?? "Registration is closed.");

  let registration: Registration;
  try {
    registration = await prisma.$transaction(async (tx) => {
      // Lock the event row so concurrent sign-ups can't push past capacity.
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${event.id} FOR UPDATE`;
      if (event.capacity != null) {
        const count = await tx.registration.count({ where: { eventId: event.id } });
        if (count >= event.capacity) throw conflict("EVENT_FULL", "This event is full.");
      }
      return tx.registration.create({
        data: {
          eventId: event.id,
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          employeeEmail: input.employeeEmail,
          deviceToken: input.deviceToken || null,
          source,
          qrToken: newQrToken(),
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateMessage(err);
    throw err;
  }

  const emailResult = await sendPassEmail({
    to: registration.employeeEmail,
    participantName: registration.employeeName,
    employeeId: registration.employeeId,
    eventName: event.name,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    qrToken: registration.qrToken,
    passUrl: `${baseUrl}/pass/${registration.qrToken}`,
    isWalkin: source === "WALKIN",
  });

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { emailStatus: emailResult.status, emailError: emailResult.error ?? null },
    include: { event: true },
  });

  return passView(updated);
}

export async function resendPassEmail(registrationId: string, baseUrl: string) {
  const r = await prisma.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!r) throw notFound("Registration not found.");
  const result = await sendPassEmail({
    to: r.employeeEmail,
    participantName: r.employeeName,
    employeeId: r.employeeId,
    eventName: r.event.name,
    venue: r.event.venue,
    startsAt: r.event.startsAt,
    endsAt: r.event.endsAt,
    qrToken: r.qrToken,
    passUrl: `${baseUrl}/pass/${r.qrToken}`,
    isWalkin: r.source === "WALKIN",
  });
  await prisma.registration.update({
    where: { id: r.id },
    data: { emailStatus: result.status, emailError: result.error ?? null },
  });
  return result;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function eventDashboard(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Event not found.");

  const [bySource, byStage, recentScans, recentRegs] = await Promise.all([
    prisma.registration.groupBy({ by: ["source"], where: { eventId }, _count: { _all: true } }),
    prisma.scan.groupBy({ by: ["stage"], where: { eventId }, _count: { _all: true } }),
    prisma.scan.findMany({
      where: { eventId },
      orderBy: { scannedAt: "desc" },
      take: 15,
      include: { registration: true, scannedBy: { select: { name: true } } },
    }),
    prisma.registration.findMany({ where: { eventId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const normal = bySource.find((r) => r.source === "NORMAL")?._count._all ?? 0;
  const walkins = bySource.find((r) => r.source === "WALKIN")?._count._all ?? 0;
  const stageCount = (s: Stage) => byStage.find((r) => r.stage === s)?._count._all ?? 0;
  const registered = normal + walkins;
  const checkedIn = stageCount("ENTRY");

  const activity = [
    ...recentScans.map((s) => ({
      kind: "SCAN" as const,
      at: s.scannedAt.toISOString(),
      stage: s.stage,
      employeeId: s.registration.employeeId,
      employeeName: s.registration.employeeName,
      location: s.locationName,
      by: s.scannedBy?.name ?? null,
    })),
    ...recentRegs.map((r) => ({
      kind: "REGISTRATION" as const,
      at: r.createdAt.toISOString(),
      stage: null,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      location: null,
      by: r.source === "WALKIN" ? "Walk-in" : null,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 20);

  return {
    eventId,
    capacity: event.capacity,
    registered,
    normal,
    walkins,
    checkedIn,
    pending: Math.max(registered - checkedIn, 0),
    food: event.foodEnabled ? stageCount("FOOD") : null,
    goodies: event.goodiesEnabled ? stageCount("GOODIES") : null,
    activity,
    generatedAt: new Date().toISOString(),
  };
}

export type Dashboard = Awaited<ReturnType<typeof eventDashboard>>;
