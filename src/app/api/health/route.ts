import { prisma } from "@/lib/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", database: "ok" });
  } catch {
    return json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
