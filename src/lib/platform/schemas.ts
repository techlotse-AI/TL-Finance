import { z } from "zod";

import { idSchema } from "@/lib/budget/schemas";

export const adminUserUpdateSchema = z.object({
  userId: idSchema,
  active: z.boolean(),
  instanceAdmin: z.boolean(),
});

export const databaseResetSchema = z.object({
  confirmation: z.literal("RESET PLATFORM DATABASE"),
  password: z.string().min(1).max(128),
});
