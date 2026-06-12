import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const [backupPath] = process.argv.slice(2);
if (!backupPath || process.env.TL_FINANCE_RESTORE_CONFIRMATION !== "RESTORE PLATFORM DATABASE") {
  console.error("Usage: set TL_FINANCE_RESTORE_CONFIRMATION=RESTORE PLATFORM DATABASE and run npm run platform:restore -- <backup.json>");
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const backup = JSON.parse(await readFile(backupPath, "utf8"));
if (backup?.format !== "tl-finance-platform-backup" || backup?.version !== 1) {
  throw new Error("Unsupported TL Finance platform-backup format.");
}
const required = [
  "users", "households", "memberships", "entitlements", "auditEvents",
  "categoryGroups", "categories", "accounts", "accountPockets", "incomeSources",
  "incomeAllocations", "plannedTransfers", "budgetItems", "exchangeRates",
  "statementImports", "actualTransactions", "actualAllocations", "allocationRules",
  "transferMatches",
];
for (const key of required) if (!Array.isArray(backup[key])) throw new Error(`Backup field ${key} is missing.`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const dateFields = new Set(["createdAt", "updatedAt", "expiresAt", "deletedAt", "startDate", "endDate", "asOf", "staleAfter", "committedAt", "bookingDate", "valueDate", "emailVerifiedAt", "confirmedAt"]);
const revive = (rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, dateFields.has(key) && value ? new Date(value) : value])));

await prisma.$transaction(async (tx) => {
  await tx.rateLimitBucket.deleteMany();
  await tx.session.deleteMany();
  await tx.emailVerificationToken.deleteMany();
  await tx.passwordResetToken.deleteMany();
  await tx.transactionTransferMatch.deleteMany();
  await tx.actualTransactionAllocation.deleteMany();
  await tx.transactionAllocationRule.deleteMany();
  await tx.actualTransaction.deleteMany();
  await tx.statementImport.deleteMany();
  await tx.budgetItem.deleteMany();
  await tx.plannedAccountTransfer.deleteMany();
  await tx.incomeAllocation.deleteMany();
  await tx.incomeSource.deleteMany();
  await tx.exchangeRate.deleteMany();
  await tx.accountPocket.deleteMany();
  await tx.account.deleteMany();
  await tx.category.deleteMany();
  await tx.categoryGroup.deleteMany();
  await tx.auditEvent.deleteMany();
  await tx.tierEntitlement.deleteMany();
  await tx.householdMember.deleteMany();
  await tx.household.deleteMany();
  await tx.user.deleteMany();

  await tx.user.createMany({ data: revive(backup.users) });
  await tx.household.createMany({ data: revive(backup.households) });
  await tx.householdMember.createMany({ data: revive(backup.memberships) });
  await tx.tierEntitlement.createMany({ data: revive(backup.entitlements) });
  await tx.categoryGroup.createMany({ data: revive(backup.categoryGroups) });
  await tx.category.createMany({ data: revive(backup.categories) });
  await tx.account.createMany({ data: revive(backup.accounts) });
  await tx.accountPocket.createMany({ data: revive(backup.accountPockets) });
  await tx.incomeSource.createMany({ data: revive(backup.incomeSources) });
  await tx.incomeAllocation.createMany({ data: revive(backup.incomeAllocations) });
  await tx.plannedAccountTransfer.createMany({ data: revive(backup.plannedTransfers) });
  await tx.budgetItem.createMany({ data: revive(backup.budgetItems) });
  await tx.exchangeRate.createMany({ data: revive(backup.exchangeRates) });
  await tx.statementImport.createMany({ data: revive(backup.statementImports) });
  await tx.actualTransaction.createMany({ data: revive(backup.actualTransactions) });
  await tx.actualTransactionAllocation.createMany({ data: revive(backup.actualAllocations) });
  await tx.transactionAllocationRule.createMany({ data: revive(backup.allocationRules) });
  await tx.transactionTransferMatch.createMany({ data: revive(backup.transferMatches) });
  await tx.auditEvent.createMany({ data: revive(backup.auditEvents) });
}, { timeout: 300_000 });

console.log(`Restored TL Finance backup from ${backupPath}. All previous sessions were revoked.`);
await prisma.$disconnect();
