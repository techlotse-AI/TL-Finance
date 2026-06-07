-- CreateEnum
CREATE TYPE "StatementInstitution" AS ENUM ('UBS', 'REVOLUT', 'ZUGER_KANTONALBANK', 'FNB', 'STANDARD_BANK', 'INVESTEC', 'FRANKLY', 'VIAC', 'SAXO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StatementImportStatus" AS ENUM ('PREVIEWED', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionReviewState" AS ENUM ('UNREVIEWED', 'PARTIAL', 'ALLOCATED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AllocationSource" AS ENUM ('RULE', 'MANUAL', 'CASH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TransferMatchStatus" AS ENUM ('CANDIDATE', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RuleMatchField" AS ENUM ('DESCRIPTION', 'MERCHANT', 'COUNTERPARTY', 'REFERENCE');

-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('EXACT', 'CONTAINS', 'PREFIX', 'REGEX');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "instanceAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StatementImport" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountPocketId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "parserKey" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "institution" "StatementInstitution" NOT NULL,
    "status" "StatementImportStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "encryptedRetentionMetadata" JSONB,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualTransaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "statementImportId" TEXT NOT NULL,
    "accountPocketId" TEXT,
    "bookingDate" DATE NOT NULL,
    "valueDate" DATE,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "reference" TEXT,
    "balanceAfter" DECIMAL(18,4),
    "normalizedMerchantKey" TEXT,
    "sourceInstitution" "StatementInstitution" NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "originalRow" JSONB NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "reviewState" "TransactionReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActualTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualTransactionAllocation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "source" "AllocationSource" NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualTransactionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAllocationRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "matchField" "RuleMatchField" NOT NULL,
    "matchType" "RuleMatchType" NOT NULL,
    "normalizedPattern" TEXT NOT NULL,
    "institution" "StatementInstitution",
    "categoryId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionAllocationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionTransferMatch" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "debitTransactionId" TEXT NOT NULL,
    "creditTransactionId" TEXT NOT NULL,
    "status" "TransferMatchStatus" NOT NULL,
    "confidence" "MatchConfidence" NOT NULL,
    "score" DECIMAL(8,6) NOT NULL,
    "evidence" JSONB NOT NULL,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionTransferMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatementImport_householdId_status_createdAt_idx" ON "StatementImport"("householdId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StatementImport_householdId_accountPocketId_idx" ON "StatementImport"("householdId", "accountPocketId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementImport_householdId_contentHash_key" ON "StatementImport"("householdId", "contentHash");

-- CreateIndex
CREATE INDEX "ActualTransaction_householdId_bookingDate_id_idx" ON "ActualTransaction"("householdId", "bookingDate", "id");

-- CreateIndex
CREATE INDEX "ActualTransaction_householdId_reviewState_bookingDate_idx" ON "ActualTransaction"("householdId", "reviewState", "bookingDate");

-- CreateIndex
CREATE INDEX "ActualTransaction_householdId_accountPocketId_bookingDate_idx" ON "ActualTransaction"("householdId", "accountPocketId", "bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "ActualTransaction_householdId_dedupeHash_key" ON "ActualTransaction"("householdId", "dedupeHash");

-- CreateIndex
CREATE INDEX "ActualTransactionAllocation_householdId_transactionId_idx" ON "ActualTransactionAllocation"("householdId", "transactionId");

-- CreateIndex
CREATE INDEX "ActualTransactionAllocation_householdId_categoryId_idx" ON "ActualTransactionAllocation"("householdId", "categoryId");

-- CreateIndex
CREATE INDEX "ActualTransactionAllocation_householdId_budgetItemId_idx" ON "ActualTransactionAllocation"("householdId", "budgetItemId");

-- CreateIndex
CREATE INDEX "TransactionAllocationRule_householdId_active_priority_idx" ON "TransactionAllocationRule"("householdId", "active", "priority");

-- CreateIndex
CREATE INDEX "TransactionTransferMatch_householdId_status_confidence_idx" ON "TransactionTransferMatch"("householdId", "status", "confidence");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTransferMatch_debitTransactionId_creditTransacti_key" ON "TransactionTransferMatch"("debitTransactionId", "creditTransactionId");

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_accountPocketId_fkey" FOREIGN KEY ("accountPocketId") REFERENCES "AccountPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransaction" ADD CONSTRAINT "ActualTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransaction" ADD CONSTRAINT "ActualTransaction_statementImportId_fkey" FOREIGN KEY ("statementImportId") REFERENCES "StatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransaction" ADD CONSTRAINT "ActualTransaction_accountPocketId_fkey" FOREIGN KEY ("accountPocketId") REFERENCES "AccountPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransactionAllocation" ADD CONSTRAINT "ActualTransactionAllocation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransactionAllocation" ADD CONSTRAINT "ActualTransactionAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ActualTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransactionAllocation" ADD CONSTRAINT "ActualTransactionAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTransactionAllocation" ADD CONSTRAINT "ActualTransactionAllocation_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAllocationRule" ADD CONSTRAINT "TransactionAllocationRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAllocationRule" ADD CONSTRAINT "TransactionAllocationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAllocationRule" ADD CONSTRAINT "TransactionAllocationRule_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionTransferMatch" ADD CONSTRAINT "TransactionTransferMatch_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionTransferMatch" ADD CONSTRAINT "TransactionTransferMatch_debitTransactionId_fkey" FOREIGN KEY ("debitTransactionId") REFERENCES "ActualTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionTransferMatch" ADD CONSTRAINT "TransactionTransferMatch_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "ActualTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
