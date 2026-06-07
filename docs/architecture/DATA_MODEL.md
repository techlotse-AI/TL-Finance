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
