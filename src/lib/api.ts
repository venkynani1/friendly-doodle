import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const notFound = (message = "Not found.") => new ApiError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(409, code, message, details);

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function toResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".");
    const message = first?.message === "Required" && field ? `${field} is required.` : (first?.message ?? "Invalid input.");
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message, details: { field } } },
      { status: 400 },
    );
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON." } }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return NextResponse.json(
      { error: { code: "DUPLICATE", message: "This record already exists." } },
      { status: 409 },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "SERVER_ERROR", message: "Something went wrong on the server. Try again." } },
    { status: 500 },
  );
}

type DefaultContext = { params: Promise<Record<string, string>> };
type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler so thrown ApiError / ZodError / Prisma errors become clean JSON responses. */
export function route<C = DefaultContext>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toResponse(err);
    }
  };
}

/** Which fields a Prisma unique-constraint error was about (P2002). */
export function uniqueTarget(err: unknown): string[] {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = (err.meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) return target.map(String);
    if (typeof target === "string") return [target];
    return [];
  }
  return [];
}

export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
