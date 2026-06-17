-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('EQUITY', 'BOND', 'FUND', 'ETF', 'CASH', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "PensionPillar" AS ENUM ('PILLAR_2', 'PILLAR_3A', 'PILLAR_3B');

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "assetClass" "AssetClass" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "priceAsOf" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldingLot" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "acquiredAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PensionVehicle" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT,
    "label" TEXT NOT NULL,
    "pillar" "PensionPillar" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "currentBalance" DECIMAL(18,4) NOT NULL,
    "annualContribution" DECIMAL(18,4) NOT NULL,
    "annualReturnRate" DECIMAL(8,6) NOT NULL,
    "yearsToRetirement" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PensionVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioComparison" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "startingAmount" DECIMAL(18,4) NOT NULL,
    "monthlyContribution" DECIMAL(18,4) NOT NULL,
    "years" INTEGER NOT NULL,
    "scenarios" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holding_householdId_deletedAt_assetClass_idx" ON "Holding"("householdId", "deletedAt", "assetClass");

-- CreateIndex
CREATE INDEX "Holding_householdId_accountId_idx" ON "Holding"("householdId", "accountId");

-- CreateIndex
CREATE INDEX "HoldingLot_householdId_holdingId_idx" ON "HoldingLot"("householdId", "holdingId");

-- CreateIndex
CREATE INDEX "PensionVehicle_householdId_deletedAt_pillar_idx" ON "PensionVehicle"("householdId", "deletedAt", "pillar");

-- CreateIndex
CREATE INDEX "ScenarioComparison_householdId_deletedAt_idx" ON "ScenarioComparison"("householdId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioComparison_householdId_name_key" ON "ScenarioComparison"("householdId", "name");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldingLot" ADD CONSTRAINT "HoldingLot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PensionVehicle" ADD CONSTRAINT "PensionVehicle_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioComparison" ADD CONSTRAINT "ScenarioComparison_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
