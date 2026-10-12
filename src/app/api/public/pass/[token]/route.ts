import { prisma } from "@/lib/db";
import { normalizeQrToken } from "@/lib/tokens";
import { json, notFound, route } from "@/lib/api";
import { passView } from "@/lib/events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

// The token itself is the secret (100-bit random), so holding it is what grants access to the pass.
export const GET = route<Ctx>(async (_req, { params }) => {
  const { token } = await params;
  const reg = await prisma.registration.findUnique({ where: { qrToken: normalizeQrToken(token) }, include: { event: true } });
  if (!reg) throw notFound("We couldn't find this pass.");
  return json({ pass: passView(reg) });
});
