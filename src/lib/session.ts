// Session token helpers. Edge-safe (used by middleware), so no Node-only imports here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ech_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours: one event day

export type StaffRole = "HR_ADMIN" | "SCANNER_OPERATOR";

export type SessionPayload = {
  sub: string;
  role: StaffRole;
  name: string;
  code: string;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or shorter than 16 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, code: payload.code })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || (payload.role !== "HR_ADMIN" && payload.role !== "SCANNER_OPERATOR")) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      name: String(payload.name ?? ""),
      code: String(payload.code ?? ""),
    };
  } catch {
    return null;
  }
}
