-- v0.9.0 (D2): financial goals / sinking funds. Additive, household-scoped,
-- soft-deleted. No destructive statements.

-- CreateTable
CREATE TABLE "FinancialGoal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "targetAmount" DECIMAL(18,4) NOT NULL,
    "currentAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "targetDate" DATE,
    "plannedMonthlyContribution" DECIMAL(18,4),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialGoal_householdId_deletedAt_idx" ON "FinancialGoal"("householdId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialGoal_householdId_name_key" ON "FinancialGoal"("householdId", "name");

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
