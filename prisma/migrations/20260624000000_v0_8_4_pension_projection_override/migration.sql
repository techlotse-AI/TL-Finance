-- v0.8.4: optional provider-stated Pillar 2 (BVG) projection on PensionVehicle.
-- Additive and nullable; no backfill required.
ALTER TABLE "PensionVehicle" ADD COLUMN "projectedCapitalOverride" DECIMAL(18,4);
ALTER TABLE "PensionVehicle" ADD COLUMN "projectedAnnualPensionOverride" DECIMAL(18,4);
