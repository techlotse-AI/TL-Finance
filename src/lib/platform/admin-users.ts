/** Minimal user shape needed to choose bulk password-reset targets. */
export interface ResettableUser {
  id: string;
  active: boolean;
  instanceAdmin: boolean;
}

/**
 * Select the users a bulk "reset all non-admin passwords" action applies to:
 * active, non-administrator accounts, never the acting administrator. Pure and
 * deterministic so the destructive selection is unit-tested. Returns ids.
 */
export function selectBulkResetUserIds(users: ResettableUser[], actingUserId: string): string[] {
  return users
    .filter((user) => user.active && !user.instanceAdmin && user.id !== actingUserId)
    .map((user) => user.id);
}
