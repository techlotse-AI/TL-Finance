import { ApiError } from "@/lib/api/errors";
import type { HouseholdRole } from "@/lib/auth/roles";
import { hasRequiredRole } from "@/lib/auth/roles";

export function assertRole(actual: HouseholdRole, required: HouseholdRole): void {
  if (!hasRequiredRole(actual, required)) {
    throw new ApiError(403, "forbidden", `The ${required} household role is required.`);
  }
}
