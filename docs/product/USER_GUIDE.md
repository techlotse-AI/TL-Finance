# User Guide

The Budget workflow plans where normalized monthly income goes.

1. Create a household and select a base currency and country preset.
2. Create account containers and select their supported currencies. Do not
   enter balances. TL Finance creates the required internal currency routes.
3. Add income sources and reconcile each source to a receiving account and
   currency.
4. Add planned account-to-account transfers.
5. Add expense, saving, investment, and retirement budget items.
6. Review the normalized monthly table and planned money-flow.

Settings supports active-household switching, categories, members, reporting
exchange rates, and validated JSON export/import. The user backup exports the
user display name plus the current live Budget plan and reporting rates for
every accessible household; import restores the display name and each backup
household as a new household owned by the importing user. Credentials,
sessions, audit logs, deleted records, and future Analyze source facts are not
included in a user backup.

Accounts currently offer EUR, CHF, ZAR, USD, and GBP in the normal workflow.
Reference rates can be refreshed from Frankfurter's free, no-key institutional
reference-rate API. Rates are reporting inputs and do not predict destination
balances.

An Essential budget item identifies required household spending for adherence
and future emergency-fund calculations. It does not change normalized totals.

Instance administrators use Platform settings for user management, household
tier assignment, S3-compatible platform backup uploads, audit-log CSV export,
and the protected platform-database reset.

One-time items remain visible but are excluded from the recurring monthly
baseline. Unallocated income, account funds, and expenses without a funding
account must remain visible.

Analyze remains locked for Budget households. Entitled households see the
started Analyze foundation, but statement parsing remains unavailable until
fixture-backed institution parsers are production-ready.

Optimize remains locked for Budget and Analyze households. Optimize households
can compare three deterministic projection scenarios using explicit starting
amount, monthly contribution, annual-return, and horizon assumptions. The
calculator compounds an effective monthly rate, applies contributions at month
end, excludes taxes and fees, stores nothing, and never changes the household
budget.
