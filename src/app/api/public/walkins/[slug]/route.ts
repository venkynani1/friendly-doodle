import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { publicEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { walkinSlug: slug } });
  if (!event) throw notFound("This walk-in link isn't valid.");
  return json({ event: publicEvent(event, "WALKIN") });
});
