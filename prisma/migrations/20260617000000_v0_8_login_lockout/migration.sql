-- AlterTable: account-targeted login lockout state (v0.8.0)
ALTER TABLE "User" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);
