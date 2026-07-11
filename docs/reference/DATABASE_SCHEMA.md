# Database Schema

The authoritative schema is `prisma/schema.prisma`.

## Identity and tenancy

- `User`, `Session`, `Household`, `HouseholdMember`
- `EmailVerificationToken`, `PasswordResetToken`
- `RateLimitBucket`
- `TierEntitlement`, `AuditEvent`

## Budget

- `CategoryGroup`, `Category`
- `Account`, `AccountPocket`
- `IncomeSource`, `IncomeAllocation`
- `PlannedAccountTransfer`
- `BudgetItem`
- `ExchangeRate`

## Analyze foundation

- `StatementImport`, `ActualTransaction`, `ActualTransactionAllocation`
- `TransactionAllocationRule`, `TransactionTransferMatch`

## Optimize

- `Holding`, `HoldingLot`, `PensionVehicle`
- `ScenarioComparison`, `FinancialGoal`
- `WealthPlan` (v0.9.1 — shared wealth-planner configuration as Json,
  validated against `wealthPlanConfigSchema` v1; results are always recomputed,
  never persisted)

All household-owned models carry `householdId`. Money uses
`Decimal(18, 4)`. Percentage fractions use `Decimal(8, 6)`. Budget models do
not contain current balances, forecasts, returns, or future values.
Actual source `balanceAfter` values are isolated to Analyze reconciliation.
`Account.maskedReference` stores only a masked IBAN/account suffix for
household-scoped statement-account suggestions.
