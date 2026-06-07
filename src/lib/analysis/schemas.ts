import { z } from "zod";

export const statementPreviewSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(1).max(15_000_000),
  contentType: z.string().max(120).optional(),
});
