-- Issue #30 (v0.8.7): classify an account as a shared "spending"/"daily" account
-- for money-flow grouping/alignment. Additive, non-null with a safe default.
ALTER TABLE "Account" ADD COLUMN "spending" BOOLEAN NOT NULL DEFAULT false;
