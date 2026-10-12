import { json, route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { validatePass } from "@/lib/scan";
import { scanInputSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  await requireStaff();
  const body = scanInputSchema.pick({ qrToken: true, eventId: true }).parse(await req.json());
  return json(await validatePass(body.qrToken, body.eventId));
});
