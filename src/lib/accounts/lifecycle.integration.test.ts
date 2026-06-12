import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activePlanReferenceCount,
  historicalReferenceCount,
  loadAccountLifecycleSummary,
} from "@/lib/accounts/lifecycle";
import { prisma } from "@/lib/db/prisma";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const suite = databaseAvailable ? describe : describe.skip;
const marker = `account-lifecycle-${Date.now()}`;
let userId = "";
let householdId = "";
let accountId = "";
let sourcePocketId = "";

suite("account lifecycle integration", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `${marker}@example.invalid`, passwordHash: "test-only" },
    });
    userId = user.id;

    const household = await prisma.household.create({
      data: {
        name: marker,
        baseCurrency: "CHF",
        members: { create: { userId, role: "OWNER" } },
      },
    });
    householdId = household.id;

    const sourceAccount = await prisma.account.create({
      data: { householdId, name: `${marker}-source`, type: "PERSONAL" },
    });
    const destinationAccount = await prisma.account.create({
      data: { householdId, name: `${marker}-destination`, type: "SAVINGS" },
    });
    accountId = sourceAccount.id;

    const sourcePocket = await prisma.accountPocket.create({
      data: { householdId, accountId: sourceAccount.id, name: "CHF", currency: "CHF" },
    });
    const destinationPocket = await prisma.accountPocket.create({
      data: { householdId, accountId: destinationAccount.id, name: "CHF", currency: "CHF" },
    });
    sourcePocketId = sourcePocket.id;

    await prisma.plannedAccountTransfer.create({
      data: {
        householdId,
        name: `${marker}-transfer`,
        fromAccountPocketId: sourcePocket.id,
        toAccountPocketId: destinationPocket.id,
        amount: "100",
        currency: "CHF",
        recurrence: "MONTHLY",
        startDate: new Date("2026-01-01"),
      },
    });
    const statementImport = await prisma.statementImport.create({
      data: {
        householdId,
        accountPocketId: sourcePocket.id,
        originalFilename: `${marker}.csv`,
        contentHash: marker,
        parserKey: "test",
        parserVersion: "1",
        institution: "UNKNOWN",
        status: "COMMITTED",
      },
    });
    await prisma.actualTransaction.create({
      data: {
        householdId,
        statementImportId: statementImport.id,
        accountPocketId: sourcePocket.id,
        bookingDate: new Date("2026-01-01"),
        amount: "-10",
        currency: "CHF",
        description: "Lifecycle test",
        sourceInstitution: "UNKNOWN",
        parserVersion: "1",
        originalRow: {},
        dedupeHash: marker,
      },
    });
  });

  afterAll(async () => {
    if (!userId) return;
    await prisma.actualTransaction.deleteMany({ where: { householdId } });
    await prisma.statementImport.deleteMany({ where: { householdId } });
    await prisma.plannedAccountTransfer.deleteMany({ where: { householdId } });
    await prisma.accountPocket.deleteMany({ where: { householdId } });
    await prisma.account.deleteMany({ where: { householdId } });
    await prisma.householdMember.deleteMany({ where: { householdId } });
    await prisma.household.delete({ where: { id: householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("blocks active planned routes and preserves Analyze history after soft deletion", async () => {
    const blocked = await loadAccountLifecycleSummary(prisma, householdId, accountId);
    expect(activePlanReferenceCount(blocked)).toBe(1);
    expect(historicalReferenceCount(blocked)).toBe(2);

    await prisma.plannedAccountTransfer.updateMany({
      where: { householdId },
      data: { active: false, deletedAt: new Date() },
    });
    const safeToDelete = await loadAccountLifecycleSummary(prisma, householdId, accountId);
    expect(activePlanReferenceCount(safeToDelete)).toBe(0);
    expect(historicalReferenceCount(safeToDelete)).toBe(2);

    await prisma.$transaction([
      prisma.accountPocket.updateMany({
        where: { householdId, accountId },
        data: { active: false, deletedAt: new Date() },
      }),
      prisma.account.updateMany({
        where: { householdId, id: accountId },
        data: { active: false, deletedAt: new Date() },
      }),
    ]);

    expect(await prisma.statementImport.count({ where: { householdId, accountPocketId: sourcePocketId } })).toBe(1);
    expect(await prisma.actualTransaction.count({ where: { householdId, accountPocketId: sourcePocketId } })).toBe(1);
  });
});
