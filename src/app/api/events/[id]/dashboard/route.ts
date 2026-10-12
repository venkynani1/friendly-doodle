import { json, route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { eventDashboard } from "@/lib/events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Scanner operators can read counts too (live counts on the scanner screen).
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireStaff();
  const { id } = await params;
  return json(await eventDashboard(id));
});
