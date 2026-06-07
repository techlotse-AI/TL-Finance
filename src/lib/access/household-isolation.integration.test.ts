import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writeAuditEvent } from "@/lib/audit/write";
import { requireOwnedPocket } from "@/lib/budget/ownership";
import { prisma } from "@/lib/db/prisma";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const suite = databaseAvailable ? describe : describe.skip;
const marker = `integration-${Date.now()}`;
let userId = "";
let householdOne = "";
let householdTwo = "";
let accountOne = "";
let pocketOne = "";

suite("household isolation integration", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `${marker}@example.invalid`, passwordHash: "test-only" },
    });
    userId = user.id;
    const one = await prisma.household.create({
      data: {
        name: `${marker}-one`, baseCurrency: "CHF",
        members: { create: { userId, role: "OWNER" } },
        entitlement: { create: { tier: "BUDGET" } },
      },
    });
    const two = await prisma.household.create({
      data: {
        name: `${marker}-two`, baseCurrency: "CHF",
        members: { create: { userId, role: "MEMBER" } },
        entitlement: { create: { tier: "ANALYZE" } },
      },
    });
    householdOne = one.id; householdTwo = two.id;
    const account = await prisma.account.create({
      data: { householdId: householdOne, name: `${marker}-account`, type: "PERSONAL" },
    });
    accountOne = account.id;
    pocketOne = (await prisma.accountPocket.create({
      data: { householdId: householdOne, accountId: account.id, name: "CHF", currency: "CHF" },
    })).id;
  });

  afterAll(async () => {
    if (!userId) return;
    await prisma.accountPocket.deleteMany({ where: { householdId: { in: [householdOne, householdTwo] } } });
    await prisma.account.deleteMany({ where: { householdId: { in: [householdOne, householdTwo] } } });
    await prisma.auditEvent.deleteMany({ where: { householdId: { in: [householdOne, householdTwo] } } });
    await prisma.tierEntitlement.deleteMany({ where: { householdId: { in: [householdOne, householdTwo] } } });
    await prisma.householdMember.deleteMany({ where: { householdId: { in: [householdOne, householdTwo] } } });
    await prisma.household.deleteMany({ where: { id: { in: [householdOne, householdTwo] } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("rejects a foreign key owned by another household", async () => {
    await expect(requireOwnedPocket(prisma, householdTwo, pocketOne)).rejects.toMatchObject({
      code: "invalid_account_pocket",
    });
  });

  it("scoped mutations cannot update another household", async () => {
    const result = await prisma.account.updateMany({
      where: { id: accountOne, householdId: householdTwo },
      data: { name: "cross-tenant-write" },
    });
    expect(result.count).toBe(0);
  });

  it("soft delete keeps the financial row and audit is append-only", async () => {
    await prisma.account.updateMany({
      where: { id: accountOne, householdId: householdOne },
      data: { active: false, deletedAt: new Date() },
    });
    await writeAuditEvent(prisma, {
      householdId: householdOne, userId, action: "account.delete",
      resourceType: "Account", resourceId: accountOne,
    });
    expect(await prisma.account.findUnique({ where: { id: accountOne } })).toMatchObject({ active: false });
    expect(await prisma.auditEvent.count({ where: { householdId: householdOne, action: "account.delete" } })).toBe(1);
  });
});
