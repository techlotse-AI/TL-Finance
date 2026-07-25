-- CreateEnum
CREATE TYPE "GoalPurpose" AS ENUM ('RETIREMENT', 'HOUSE_DEPOSIT', 'EDUCATION', 'WEALTH_BUILDING', 'OTHER');

-- AlterTable
ALTER TABLE "FinancialGoal" ADD COLUMN     "purpose" "GoalPurpose";
