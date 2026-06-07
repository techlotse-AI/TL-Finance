import { Prisma } from "@prisma/client";
import { z } from "zod";

import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { assertTrustedOrigin } from "@/lib/auth/origin";

export async function readJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  assertTrustedOrigin(request);
  return schema.parse(await request.json());
}

export function routeError(error: unknown): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiErrorResponse(new ApiError(409, "conflict", "A record with these values exists."));
    }

    if (error.code === "P2003") {
      return apiErrorResponse(
        new ApiError(409, "referenced_record", "This record is still referenced."),
      );
    }
  }

  return apiErrorResponse(error);
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(serialize(data), init);
}

function serialize(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toFixed(4);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        serialize(nested),
      ]),
    );
  }

  return value;
}
