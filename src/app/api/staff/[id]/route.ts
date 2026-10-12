import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, route } from "@/lib/api";
import { requireHr } from "@/lib/auth";
import { staffUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const select = { id: true, employeeCode: true, name: true, role: true, active: true, createdAt: true } as const;

/** Body: { active?, password?, name? } */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const me = await requireHr();
  const { id } = await params;
  const input = staffUpdateSchema.parse(await req.json());
  const target = await prisma.staffUser.findUnique({ where: { id } });
  if (!target) throw notFound("Account not found.");

  if (input.active === false) {
    if (target.id === me.id) throw badRequest("SELF_DEACTIVATE", "You can't deactivate your own account.");
    if (target.role === "HR_ADMIN") {
      const otherAdmins = await prisma.staffUser.count({ where: { role: "HR_ADMIN", active: true, id: { not: id } } });
      if (otherAdmins === 0) throw badRequest("LAST_ADMIN", "Keep at least one active HR admin.");
    }
  }

  const user = await prisma.staffUser.update({
    where: { id },
    data: {
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
    },
    select,
  });
  return json({ user });
});
