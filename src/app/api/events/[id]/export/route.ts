import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { formatCsvDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function csvCell(v: string | null | undefined) {
  const s = v ?? "";
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireHr();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound("Event not found.");

  const rows = await prisma.registration.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
    include: { scans: true },
  });

  const header = ["employeeId", "employeeName", "employeeEmail", "source", "registeredAt", "qrToken", "entryStatus", "entryTime", "entryLocation"];
  if (event.foodEnabled) header.push("foodStatus", "foodTime", "foodLocation");
  if (event.goodiesEnabled) header.push("goodiesStatus", "goodiesTime", "goodiesLocation");
  header.push("emailStatus");

  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const stageCols = (stage: "ENTRY" | "FOOD" | "GOODIES") => {
      const s = r.scans.find((x) => x.stage === stage);
      return [s ? "DONE" : "PENDING", formatCsvDate(s?.scannedAt), s?.locationName ?? ""];
    };
    const cols = [r.employeeId, r.employeeName, r.employeeEmail, r.source, formatCsvDate(r.createdAt), r.qrToken, ...stageCols("ENTRY")];
    if (event.foodEnabled) cols.push(...stageCols("FOOD"));
    if (event.goodiesEnabled) cols.push(...stageCols("GOODIES"));
    cols.push(r.emailStatus);
    lines.push(cols.map(csvCell).join(","));
  }

  const safeName = event.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
  const date = formatCsvDate(new Date()).slice(0, 10);
  // BOM so Excel opens UTF-8 names correctly.
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-report-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
