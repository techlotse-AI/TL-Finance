import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api/errors";

type OwnershipClient = Pick<
  Prisma.TransactionClient,
  "account" | "accountPocket" | "category" | "categoryGroup" | "incomeSource"
>;

export async function requireOwnedCategory(
  client: OwnershipClient,
  householdId: string,
  categoryId: string,
) {
  const category = await client.category.findFirst({
    where: { id: categoryId, householdId, deletedAt: null, active: true },
  });
  if (!category) throw new ApiError(400, "invalid_category", "Category does not belong to household.");
  return category;
}

export async function requireOwnedCategoryGroup(
  client: OwnershipClient,
  householdId: string,
  groupId: string,
) {
  const group = await client.categoryGroup.findFirst({
    where: { id: groupId, householdId, deletedAt: null, active: true },
  });
  if (!group) throw new ApiError(400, "invalid_category_group", "Category group does not belong to household.");
  return group;
}

export async function requireOwnedAccount(
  client: OwnershipClient,
  householdId: string,
  accountId: string,
) {
  const account = await client.account.findFirst({
    where: { id: accountId, householdId, deletedAt: null, active: true },
  });
  if (!account) throw new ApiError(400, "invalid_account", "Account does not belong to household.");
  return account;
}

export async function requireOwnedPocket(
  client: OwnershipClient,
  householdId: string,
  pocketId: string,
) {
  const pocket = await client.accountPocket.findFirst({
    where: {
      id: pocketId,
      householdId,
      deletedAt: null,
      active: true,
      account: { householdId, deletedAt: null, active: true },
    },
  });
  if (!pocket) throw new ApiError(400, "invalid_account_pocket", "Account pocket does not belong to household.");
  return pocket;
}

export async function requireOwnedIncomeSource(
  client: OwnershipClient,
  householdId: string,
  incomeSourceId: string,
) {
  const source = await client.incomeSource.findFirst({
    where: { id: incomeSourceId, householdId, deletedAt: null, active: true },
  });
  if (!source) throw new ApiError(400, "invalid_income_source", "Income source does not belong to household.");
  return source;
}
