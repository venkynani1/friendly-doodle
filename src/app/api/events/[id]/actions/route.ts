import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { eventActionSchema } from "@/lib/validation";
import { hrEvent } from "@/lib/events";
import { appUrl } from "@/lib/url";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Event controls in one place. Body: { action, until? }
 * open | complete | reopen | registration-open | registration-close | registration-extend
 * | walkins-open | walkins-close | walkins-extend
 */
export const POST = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const body = eventActionSchema.parse(await req.json());
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound("Event not found.");

  const now = new Date();
  let data: Prisma.EventUpdateInput;
  switch (body.action) {
    case "open":
      data = { status: "OPEN" };
      break;
    case "complete":
      data = { status: "COMPLETED", registrationOpen: false, walkinOpen: false };
      break;
    case "reopen":
      data = { status: "OPEN" };
      break;
    case "registration-open":
      // Reopening also clears a past close time, otherwise the window would stay shut.
      data = {
        registrationOpen: true,
        ...(event.registrationClosesAt && event.registrationClosesAt < now ? { registrationClosesAt: null } : {}),
      };
      break;
    case "registration-close":
      data = { registrationOpen: false };
      break;
    case "registration-extend":
      if (body.until <= now) throw badRequest("INVALID_TIME", "Pick a time in the future.");
      data = { registrationOpen: true, registrationClosesAt: body.until };
      break;
    case "walkins-open":
      if (!event.walkinsEnabled) throw badRequest("WALKINS_DISABLED", "Turn on walk-ins in the event settings first.");
      data = {
        walkinOpen: true,
        ...(event.walkinClosesAt && event.walkinClosesAt < now ? { walkinClosesAt: null } : {}),
      };
      break;
    case "walkins-close":
      data = { walkinOpen: false };
      break;
    case "walkins-extend":
      if (!event.walkinsEnabled) throw badRequest("WALKINS_DISABLED", "Turn on walk-ins in the event settings first.");
      if (body.until <= now) throw badRequest("INVALID_TIME", "Pick a time in the future.");
      data = { walkinOpen: true, walkinClosesAt: body.until };
      break;
    default:
      throw badRequest("UNKNOWN_ACTION", "Unknown action.");
  }

  const updated = await prisma.event.update({ where: { id }, data });
  return json({ event: hrEvent(updated, appUrl(req)) });
});
