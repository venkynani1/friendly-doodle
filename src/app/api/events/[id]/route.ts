import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { eventInputSchema, stagesToFlags } from "@/lib/validation";
import { hrEvent } from "@/lib/events";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound("Event not found.");
  return json({ event: hrEvent(event, appUrl(req)) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const input = eventInputSchema.parse(await req.json());
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw notFound("Event not found.");
  const event = await prisma.event.update({
    where: { id },
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
    },
  });
  return json({ event: hrEvent(event, appUrl(req)) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireHr();
  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw notFound("Event not found.");
  await prisma.event.delete({ where: { id } });
  return json({ ok: true });
});
