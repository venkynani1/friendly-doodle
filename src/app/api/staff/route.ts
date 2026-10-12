import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { conflict, isUniqueViolation, json, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { staffCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const select = { id: true, employeeCode: true, name: true, role: true, active: true, createdAt: true } as const;

export const GET = route(async () => {
  await requireHr();
  const staff = await prisma.staffUser.findMany({ orderBy: [{ role: "asc" }, { employeeCode: "asc" }], select });
  return json({ staff });
});

export const POST = route(async (req) => {
  await requireHr();
  const input = staffCreateSchema.parse(await req.json());
  try {
    const user = await prisma.staffUser.create({
      data: {
        employeeCode: input.employeeCode,
        name: input.name,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
      select,
    });
    return json({ user }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("DUPLICATE_CODE", "An account with this employee code already exists.");
    throw err;
  }
});
