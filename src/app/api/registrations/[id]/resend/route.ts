import { json, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { resendPassEmail } from "@/lib/events";
import { appUrl } from "@/lib/url";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const result = await resendPassEmail(id, appUrl(req));
  return json(result);
});
