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
sessions, audit logs, deleted records, and Analyze source facts are not
included in a user backup.

Accounts currently offer EUR, CHF, ZAR, USD, and GBP in the normal workflow.
Reference rates can be refreshed from Frankfurter's free, no-key institutional
reference-rate API. Rates are reporting inputs and do not predict destination
balances.

An Essential budget item identifies required household spending for adherence
and future emergency-fund calculations. It does not change normalized totals.

Instance administrators use Platform settings for user management, household
tier assignment, S3-compatible platform backup uploads, audit-log CSV export,
and the protected platform-database reset. Reset preserves the current
administrator, current session, and append-only audit history while removing
other platform operational and financial data.

One-time items remain visible but are excluded from the recurring monthly
baseline. Unallocated income, account funds, and expenses without a funding
account must remain visible.

## Analyze

Analyze turns real statements into categorized, reconciled activity and
compares it to the Budget plan. It is available to Analyze and Optimize
households; Budget households see a locked overview.

1. **Import.** Upload a statement CSV and pick the account it belongs to.
   Production-ready parsers cover UBS account and UBS card exports, Revolut
   transactions, and a generic `date,amount,currency,description` template.
   Preview detects the format, normalizes rows, and reports any skipped or
   flagged rows without writing anything. Commit is idempotent: the same file
   imports no duplicates, deduplicated by content hash and per-row hash.
2. **Review.** Imported transactions start unreviewed. Allocate each to a
   category, or define allocation rules (by merchant, description, counterparty,
   or reference; exact, contains, prefix, or regex) and apply them in bulk.
   Unknown activity stays in the review queue and is never silently assigned.
3. **Transfers.** Scan to match internal transfers and FX exchanges across
   accounts. High-confidence opposite-and-equal pairs auto-confirm;
   medium-confidence and cross-currency pairs wait for your confirmation.
   Confirmed transfers are excluded from spending so they never inflate a
   category.
4. **Adherence.** Compare planned monthly budget to actual allocated spending
   per category and currency, with over, under, on-track, or unplanned status.
5. **Findings.** Deterministic money-leak detection surfaces over-budget
   categories, likely duplicate charges, recurring and rising subscriptions, and
   the review backlog. No AI is used in parsing, allocation, matching, or
   findings.

## Optimize

Optimize remains locked for Budget and Analyze households. Optimize households
can compare three deterministic projection scenarios using explicit starting
amount, monthly contribution, annual-return, and horizon assumptions. The
calculator compounds an effective monthly rate, applies contributions at month
end, excludes taxes and fees, stores nothing, and never changes the household
budget.
