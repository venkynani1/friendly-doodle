import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/session";

const invalid = () => new ApiError(401, "INVALID_CREDENTIALS", "Employee code or password is incorrect.");

/**
 * First-run bootstrap: while no staff accounts exist, the BOOTSTRAP_ADMIN_CODE /
 * BOOTSTRAP_ADMIN_PASSWORD credentials create the first HR admin.
 */
async function bootstrapIfEmpty(code: string, password: string) {
  const count = await prisma.staffUser.count();
  if (count > 0) return null;
  const bootCode = process.env.BOOTSTRAP_ADMIN_CODE?.trim().toUpperCase();
  const bootPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!bootCode || !bootPassword || code !== bootCode || password !== bootPassword) return null;
  return prisma.staffUser.create({
    data: {
      employeeCode: bootCode,
      name: "HR Admin",
      role: "HR_ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}

export const POST = route(async (req) => {
  const { employeeCode, password } = loginSchema.parse(await req.json());

  let user = await prisma.staffUser.findUnique({ where: { employeeCode } });
  if (!user) user = await bootstrapIfEmpty(employeeCode, password);
  if (!user || !user.active) throw invalid();
  if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid();

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, code: user.employeeCode });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return json({ user: { id: user.id, employeeCode: user.employeeCode, name: user.name, role: user.role } });
});
