# Data Model

The v0.1.0 schema models identity, tenancy, manual tier entitlements, audit, and
the complete planned Budget domain.

`Account` is an institution-level payment-route container. `AccountPocket` is a
currency-specific flow node. Neither model stores balances.

`IncomeSource` uses fixed or percentage `IncomeAllocation` rows to route income
to receiving pockets. `PlannedAccountTransfer` moves planned money between
pockets and is neither income nor spending.

`BudgetItem` is an expense, saving, investment, or retirement allocation.
Saving, investment, and retirement items require distinct source and
destination pockets.

Every household-owned row includes `householdId`. User-managed financial
records use `active` and `deletedAt` for soft deletion. See
[DATABASE_SCHEMA.md](../reference/DATABASE_SCHEMA.md) for field-level detail.

`ExchangeRate` centralizes explicit native-to-reporting-currency conversion and
stale-rate metadata.

The additive v0.2.0 foundation adds `StatementImport`, immutable
`ActualTransaction` source facts, `ActualTransactionAllocation`,
`TransactionAllocationRule`, and `TransactionTransferMatch`. Source statement
balances exist only for import reconciliation and do not add Budget balances.

v0.4.0 adds `RateLimitBucket`, a shared PostgreSQL-backed authentication
throttle keyed by an HMAC rather than raw email or IP values. Verification and
password-reset token models store only token hashes and expiry/usage metadata.

## Optimize holdings, pensions, and scenarios (v0.7.0 / v0.7.5)

These tables are Optimize-owned and balance-bearing. They never participate in
the Budget planned money-flow graph.

- `Holding` and `HoldingLot`: manual positions and their cost-basis lots. A
  holding stores its native currency and latest `unitPrice`; lots store
  `quantity` (Decimal 18,6) and `unitCost`. Valuation, unrealized gain, and
  asset-class/currency allocation are computed deterministically and converted
  to the household base currency via the latest `ExchangeRate`; currencies with
  no rate are reported, not silently mixed.
- `PensionVehicle`: a Pillar 2/3a/3b capital vehicle (balance, annual
  contribution, return rate, years to retirement) plus optional provider-stated
  projection columns `projectedCapitalOverride` and
  `projectedAnnualPensionOverride` (v0.8.4) for entering the figures from a Swiss
  Pillar 2 (BVG) statement. When the capital override is set, it is used as the
  projected ending balance instead of the computed projection. Pillar 1 (AHV) is
  an income pension computed from inputs, not stored here.
- `ScenarioComparison`: a saved projection definition (starting amount, monthly
  contribution, horizon, and per-scenario return assumptions stored as JSON),
  unique per household name. Results are recomputed from the stored definition.

All four tables carry `householdId`, soft-delete (`active`/`deletedAt`), and are
written through audited routes. Migrations:
`20260616000000_v0_7_optimize_holdings_pensions` and the additive
`20260624000000_v0_8_4_pension_projection_override` (Pillar 2 projection
override columns).

## Login lockout (v0.8.0)

`User` carries `failedLoginCount`, `lockedUntil`, and `lastFailedLoginAt`.
These track an account-targeted sign-in lockout that complements the
IP/volume `RateLimitBucket`. The signin route increments the count on each
failed attempt, sets `lockedUntil` to an escalating backoff once the
threshold is reached, and clears both on a successful sign-in. A completed
password reset and an administrator unlock also clear them. Migration:
`20260617000000_v0_8_login_lockout` (additive).
