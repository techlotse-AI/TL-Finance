import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => /[a-z]/.test(value), "Password requires a lowercase letter.")
  .refine((value) => /[A-Z]/.test(value), "Password requires an uppercase letter.")
  .refine((value) => /\d/.test(value), "Password requires a number.");

export const signUpSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const signInSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
