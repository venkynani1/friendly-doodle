import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { qrPng } from "@/lib/qr";
import { appUrl } from "@/lib/url";

type Ctx = { params: Promise<{ id: string }> };

/** PNG QR of the public registration (?type=registration) or walk-in (?type=walkin) link. */
export const GET = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound("Event not found.");
  const type = new URL(req.url).searchParams.get("type") === "walkin" ? "walkin" : "registration";
  const base = appUrl(req);
  const link = type === "walkin" ? `${base}/walkin/${event.walkinSlug}` : `${base}/register/${event.registrationSlug}`;
  const png = await qrPng(link);
  const safeName = event.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${safeName}-${type}-qr.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
