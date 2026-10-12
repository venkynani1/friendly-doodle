import { json, route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireStaff();
  return json({ user });
});
