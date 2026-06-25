import { z } from "zod";

import { idSchema } from "@/lib/budget/schemas";

export const adminUserUpdateSchema = z.object({
  userId: idSchema,
  active: z.boolean(),
  instanceAdmin: z.boolean(),
});

export const adminUserUnlockSchema = z.object({
  userId: idSchema,
});

export const databaseResetSchema = z.object({
  confirmation: z.literal("RESET PLATFORM DATABASE"),
  password: z.string().min(1).max(128),
});

// --- v0.8.5 admin household-membership management ---

export const adminHouseholdMemberSchema = z.object({
  householdId: idSchema,
  userId: idSchema,
  role: z.enum(["admin", "member"]).default("member"),
});

export const adminHouseholdMemberRemoveSchema = z.object({
  householdId: idSchema,
  userId: idSchema,
});

// --- v0.8.5 admin password reset ---

const strongPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => /[a-z]/.test(value), "Password requires a lowercase letter.")
  .refine((value) => /[A-Z]/.test(value), "Password requires an uppercase letter.")
  .refine((value) => /\d/.test(value), "Password requires a number.");

export const adminPasswordResetSchema = z
  .object({
    userId: idSchema.optional(),
    allNonAdmin: z.boolean().optional(),
    newPassword: strongPasswordSchema,
  })
  .superRefine((value, context) => {
    const single = Boolean(value.userId);
    const bulk = value.allNonAdmin === true;
    if (single === bulk) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of userId or allNonAdmin.",
        path: ["userId"],
      });
    }
  });
