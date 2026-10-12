import { z } from "zod";

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max);

export const stagesSchema = z.enum(["ENTRY", "ENTRY_FOOD", "ENTRY_FOOD_GOODIES"]);

export const eventInputSchema = z
  .object({
    name: trimmed(120),
    description: z.string().trim().max(1000).optional().nullable(),
    venue: trimmed(160),
    startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
    endsAt: optionalDate,
    capacity: z
      .union([z.number().int().positive().max(100000), z.null()])
      .optional()
      .transform((v) => v ?? null),
    stages: stagesSchema,
    registrationOpensAt: optionalDate,
    registrationClosesAt: optionalDate,
    walkinsEnabled: z.boolean(),
    walkinClosesAt: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time." });
    }
    if (v.registrationOpensAt && v.registrationClosesAt && v.registrationClosesAt <= v.registrationOpensAt) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationClosesAt"],
        message: "Registration must close after it opens.",
      });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export function stagesToFlags(stages: z.infer<typeof stagesSchema>) {
  return {
    foodEnabled: stages !== "ENTRY",
    goodiesEnabled: stages === "ENTRY_FOOD_GOODIES",
  };
}

export const eventActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("registration-open") }),
  z.object({ action: z.literal("registration-close") }),
  z.object({
    action: z.literal("registration-extend"),
    until: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  }),
  z.object({ action: z.literal("walkins-open") }),
  z.object({ action: z.literal("walkins-close") }),
  z.object({
    action: z.literal("walkins-extend"),
    until: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  }),
]);

export const registrationInputSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, "Enter your employee ID")
    .max(40)
    .regex(/^[A-Za-z0-9._\-/]+$/, "Employee ID can only contain letters, numbers, and . _ - /")
    .transform((v) => v.toUpperCase()),
  employeeName: trimmed(120),
  employeeEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(200)
    .transform((v) => v.toLowerCase()),
  deviceToken: z.string().trim().min(8).max(100).optional().nullable(),
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;

export const stageSchema = z.enum(["ENTRY", "FOOD", "GOODIES"]);

export const scanInputSchema = z.object({
  qrToken: z.string().trim().min(8, "Enter the QR token").max(200),
  stage: stageSchema,
  locationName: z.string().trim().max(80).optional().nullable(),
  eventId: z.string().trim().optional().nullable(),
});

export const loginSchema = z.object({
  employeeCode: z.string().trim().min(1, "Enter your employee code").max(40).transform((v) => v.toUpperCase()),
  password: z.string().min(1, "Enter your password").max(200),
});

export const staffCreateSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9._\-]+$/, "Use letters, numbers, and . _ - only")
    .transform((v) => v.toUpperCase()),
  name: trimmed(120),
  role: z.enum(["HR_ADMIN", "SCANNER_OPERATOR"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const staffUpdateSchema = z.object({
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
  name: trimmed(120).optional(),
});
