import { z } from "zod";

import { currencySchema, idSchema, nameSchema } from "@/lib/budget/schemas";

export const createHouseholdSchema = z.object({
  name: nameSchema,
  baseCurrency: currencySchema,
  countryProfile: z.enum(["generic", "swiss", "za"]).default("generic"),
});

export const selectHouseholdSchema = z.object({
  householdId: idSchema,
});

export const addMemberSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  active: z.boolean().optional(),
});

export const tierAssignmentSchema = z.object({
  householdId: idSchema,
  tier: z.enum(["budget", "analyze", "optimize"]),
  active: z.boolean().default(true),
  expiresAt: z.coerce.date().nullable().optional(),
});
