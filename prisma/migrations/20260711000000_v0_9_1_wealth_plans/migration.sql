-- v0.9.1: cashflow & wealth planner. Persists the shared plan configuration
-- (JSON, wealthPlanConfigSchema v1) that drives the wealth-projection and
-- drawdown views. Additive, household-scoped, soft-deleted. No destructive
-- statements.

-- CreateTable
CREATE TABLE "WealthPlan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WealthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WealthPlan_householdId_deletedAt_idx" ON "WealthPlan"("householdId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WealthPlan_householdId_name_key" ON "WealthPlan"("householdId", "name");

-- AddForeignKey
ALTER TABLE "WealthPlan" ADD CONSTRAINT "WealthPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
