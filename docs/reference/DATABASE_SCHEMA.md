# Database Schema

The authoritative schema is `prisma/schema.prisma`.

## Identity and tenancy

- `User`, `Session`, `Household`, `HouseholdMember`
- `EmailVerificationToken`, `PasswordResetToken`
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

All household-owned models carry `householdId`. Money uses
`Decimal(18, 4)`. Percentage fractions use `Decimal(8, 6)`. Budget models do
not contain current balances, forecasts, returns, or future values.
Actual source `balanceAfter` values are isolated to Analyze reconciliation.
