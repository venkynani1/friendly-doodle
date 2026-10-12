import { prisma } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireHr, requireStaff } from "@/lib/auth";
import { eventInputSchema, stagesToFlags } from "@/lib/validation";
import { newSlug } from "@/lib/tokens";
import { hrEvent } from "@/lib/events";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/** HR: all events with counts. Scanner operators: only events open for scanning. */
export const GET = route(async (req) => {
  const user = await requireStaff();
  const events = await prisma.event.findMany({
    where: user.role === "HR_ADMIN" ? {} : { status: "OPEN" },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  const checkedIn = await prisma.scan.groupBy({
    by: ["eventId"],
    where: { stage: "ENTRY", eventId: { in: events.map((e) => e.id) } },
    _count: { _all: true },
  });
  const base = appUrl(req);
  return json({
    events: events.map((e) => ({
      ...hrEvent(e, base),
      registeredCount: e._count.registrations,
      checkedInCount: checkedIn.find((c) => c.eventId === e.id)?._count._all ?? 0,
    })),
  });
});

export const POST = route(async (req) => {
  const user = await requireHr();
  const input = eventInputSchema.parse(await req.json());
  const event = await prisma.event.create({
    data: {
      name: input.name,
      description: input.description || null,
      venue: input.venue,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      ...stagesToFlags(input.stages),
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      walkinsEnabled: input.walkinsEnabled,
      walkinClosesAt: input.walkinClosesAt,
      registrationSlug: newSlug(input.name),
      walkinSlug: newSlug(`${input.name}-walkin`),
      createdById: user.id,
    },
  });
  return json({ event: hrEvent(event, appUrl(req)) }, { status: 201 });
});
