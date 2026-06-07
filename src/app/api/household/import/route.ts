import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { householdImportSchema } from "@/lib/households/export";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, householdImportSchema);
    const household = await prisma.$transaction(async (transaction) => {
      const created = await transaction.household.create({
        data: {
          name: `${input.household.name} (imported)`,
          baseCurrency: input.household.baseCurrency,
          countryProfile: input.household.countryProfile,
          members: { create: { userId: session.userId, role: "OWNER" } },
          entitlement: { create: { tier: "BUDGET", source: "import" } },
        },
      });
      const groupMap = new Map<string, string>();
      const categoryMap = new Map<string, string>();
      const accountMap = new Map<string, string>();
      const pocketMap = new Map<string, string>();

      for (const group of input.categoryGroups) {
        const inserted = await transaction.categoryGroup.create({
          data: { householdId: created.id, name: group.name, sortOrder: group.sortOrder },
        });
        groupMap.set(group.id, inserted.id);
      }
      for (const category of input.categories) {
        const groupId = groupMap.get(category.groupId);
        if (!groupId) throw new ApiError(400, "invalid_import_reference", "Category references an unknown group.");
        const inserted = await transaction.category.create({
          data: {
            householdId: created.id, groupId, name: category.name, kind: category.kind,
            essential: category.essential, sortOrder: category.sortOrder,
          },
        });
        categoryMap.set(category.id, inserted.id);
      }
      for (const account of input.accounts) {
        const inserted = await transaction.account.create({
          data: {
            householdId: created.id, name: account.name, type: account.type,
            institution: account.institution, maskedReference: account.maskedReference,
          },
        });
        accountMap.set(account.id, inserted.id);
      }
      for (const pocket of input.accountPockets) {
        const accountId = accountMap.get(pocket.accountId);
        if (!accountId) throw new ApiError(400, "invalid_import_reference", "Pocket references an unknown account.");
        const inserted = await transaction.accountPocket.create({
          data: { householdId: created.id, accountId, name: pocket.name, currency: pocket.currency },
        });
        pocketMap.set(pocket.id, inserted.id);
      }
      for (const source of input.incomeSources) {
        const categoryId = categoryMap.get(source.categoryId);
        if (!categoryId) throw new ApiError(400, "invalid_import_reference", "Income source references an unknown category.");
        await transaction.incomeSource.create({
          data: {
            householdId: created.id, name: source.name, categoryId, amount: source.amount,
            currency: source.currency, recurrence: source.recurrence, selectedMonths: source.selectedMonths,
            startDate: source.startDate, endDate: source.endDate,
            allocations: { create: source.allocations.map((allocation) => {
              const accountPocketId = pocketMap.get(allocation.accountPocketId);
              if (!accountPocketId) throw new ApiError(400, "invalid_import_reference", "Income allocation references an unknown pocket.");
              return {
                householdId: created.id, accountPocketId, method: allocation.method,
                fixedAmount: allocation.fixedAmount, percentage: allocation.percentage,
                sourceCurrency: allocation.sourceCurrency,
              };
            }) },
          },
        });
      }
      for (const transfer of input.plannedTransfers) {
        const fromAccountPocketId = pocketMap.get(transfer.fromAccountPocketId);
        const toAccountPocketId = pocketMap.get(transfer.toAccountPocketId);
        if (!fromAccountPocketId || !toAccountPocketId) throw new ApiError(400, "invalid_import_reference", "Transfer references an unknown pocket.");
        await transaction.plannedAccountTransfer.create({
          data: {
            householdId: created.id, name: transfer.name, fromAccountPocketId, toAccountPocketId,
            amount: transfer.amount, currency: transfer.currency, recurrence: transfer.recurrence,
            selectedMonths: transfer.selectedMonths, startDate: transfer.startDate, endDate: transfer.endDate,
          },
        });
      }
      for (const item of input.budgetItems) {
        const categoryId = categoryMap.get(item.categoryId);
        if (!categoryId) throw new ApiError(400, "invalid_import_reference", "Budget item references an unknown category.");
        const paidFromAccountPocketId = item.paidFromAccountPocketId ? pocketMap.get(item.paidFromAccountPocketId) : null;
        const paidToAccountPocketId = item.paidToAccountPocketId ? pocketMap.get(item.paidToAccountPocketId) : null;
        if (item.paidFromAccountPocketId && !paidFromAccountPocketId) throw new ApiError(400, "invalid_import_reference", "Budget item references an unknown funding pocket.");
        if (item.paidToAccountPocketId && !paidToAccountPocketId) throw new ApiError(400, "invalid_import_reference", "Budget item references an unknown destination pocket.");
        await transaction.budgetItem.create({
          data: {
            householdId: created.id, name: item.name, categoryId, kind: item.kind, amount: item.amount,
            currency: item.currency, recurrence: item.recurrence, selectedMonths: item.selectedMonths,
            paidFromAccountPocketId, paidToAccountPocketId, startDate: item.startDate,
            endDate: item.endDate, essential: item.essential,
          },
        });
      }
      if (input.exchangeRates.length > 0) {
        await transaction.exchangeRate.createMany({
          data: input.exchangeRates.map((rate) => ({
            householdId: created.id, fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency,
            rate: rate.rate, asOf: rate.asOf, source: rate.source, staleAfter: rate.staleAfter,
          })),
        });
      }
      await transaction.session.update({ where: { id: session.sessionId }, data: { activeHouseholdId: created.id } });
      await writeAuditEvent(transaction, {
        householdId: created.id, userId: session.userId, action: "household.import",
        resourceType: "Household", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    }, { timeout: 30_000 });
    return json({ household }, { status: 201 });
  } catch (error) { return routeError(error); }
}
