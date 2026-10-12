import { cookies } from "next/headers";
import { prisma } from "./db";
import { ApiError } from "./api";
import { SESSION_COOKIE, verifySession, type StaffRole } from "./session";

export type CurrentUser = {
  id: string;
  employeeCode: string;
  name: string;
  role: StaffRole;
};

/** Reads the session cookie and confirms the account still exists and is active. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.staffUser.findUnique({ where: { id: session.sub } });
  if (!user || !user.active) return null;
  return { id: user.id, employeeCode: user.employeeCode, name: user.name, role: user.role };
}

export async function requireUser(roles?: StaffRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "Your account doesn't have access to this.");
  }
  return user;
}

export const requireHr = () => requireUser(["HR_ADMIN"]);
export const requireStaff = () => requireUser(["HR_ADMIN", "SCANNER_OPERATOR"]);
