import { json, route } from "@/lib/api";
import { registerParticipant } from "@/lib/events";
import { registrationInputSchema } from "@/lib/validation";
import { appUrl } from "@/lib/url";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  const input = registrationInputSchema.parse(await req.json());
  const pass = await registerParticipant({ slug, source: "WALKIN", input, baseUrl: appUrl(req) });
  return json({ pass }, { status: 201 });
});
