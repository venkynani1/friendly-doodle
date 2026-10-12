import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { enabledStages } from "@/lib/events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Participant list with per-stage status. Query: ?q=search&source=NORMAL|WALKIN&take=200 */
export const GET = route<Ctx>(async (req, { params }) => {
  await requireHr();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound("Event not found.");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const source = url.searchParams.get("source");
  const take = Math.min(Number(url.searchParams.get("take")) || 200, 1000);

  const where: Prisma.RegistrationWhereInput = { eventId: id };
  if (source === "NORMAL" || source === "WALKIN") where.source = source;
  if (q) {
    where.OR = [
      { employeeId: { contains: q, mode: "insensitive" } },
      { employeeName: { contains: q, mode: "insensitive" } },
      { employeeEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { scans: true },
    }),
  ]);

  const stages = enabledStages(event);
  return json({
    total,
    stages,
    registrations: rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeEmail: r.employeeEmail,
      source: r.source,
      registeredAt: r.createdAt.toISOString(),
      emailStatus: r.emailStatus,
      emailError: r.emailError,
      scans: Object.fromEntries(
        stages.map((s) => [s, r.scans.find((x) => x.stage === s)?.scannedAt.toISOString() ?? null]),
      ),
    })),
  });
});
