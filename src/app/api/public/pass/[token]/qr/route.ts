import { prisma } from "@/lib/db";
import { normalizeQrToken } from "@/lib/tokens";
import { notFound, route } from "@/lib/api";
import { qrPng } from "@/lib/qr";

type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { token } = await params;
  const reg = await prisma.registration.findUnique({ where: { qrToken: normalizeQrToken(token) }, select: { qrToken: true, employeeId: true } });
  if (!reg) throw notFound("We couldn't find this pass.");
  const png = await qrPng(reg.qrToken);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="event-pass-${reg.employeeId}.png"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
});
