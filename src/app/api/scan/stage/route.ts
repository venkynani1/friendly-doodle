import { json, route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { recordStageScan } from "@/lib/scan";
import { scanInputSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const user = await requireStaff();
  const body = scanInputSchema.parse(await req.json());
  const result = await recordStageScan({ ...body, scannedById: user.id });
  return json(result, { status: 201 });
});
