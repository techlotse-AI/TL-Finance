# User Guide

The Budget workflow plans where normalized monthly income goes.

1. Create a household and select a base currency and country preset.
2. Create account containers and select their supported currencies. Optionally
   enter an IBAN or account reference; TL Finance immediately stores only a
   masked suffix and uses it to suggest the account during statement preview.
   Do not enter balances. TL Finance creates the required internal currency routes.
3. Add income sources and reconcile each source to a receiving account and
   currency.
4. Add planned account-to-account transfers.
5. Add expense, saving, investment, and retirement budget items.
6. Review the normalized monthly table and planned money-flow.

For budget-item amounts, enter the full amount paid per selected recurrence:
the weekly amount for Weekly, the quarterly invoice for Quarterly, and the full
annual invoice for Yearly. TL Finance normalizes weekly amounts using
`amount × 52 ÷ 12`, divides quarterly amounts by 3, and divides yearly amounts
by 12. Selected-month recurrence treats the entered amount as the payment made
in each selected month. One-time items are excluded from the recurring monthly
baseline.

The money-flow graph lays routes out from left to right. Internal transfers and
contribution destinations may repeat an account in a later visual stage so the
route direction remains explicit. Node height and route width reflect normalized
monthly value, while connected nodes and attachment points are ordered to reduce
crossing and overlap. Income sources are grouped into clear receiving-account
lanes, with the dominant source closest to its account and smaller supporting
sources placed inward. Categories and budget items are ordered from largest to
smallest. Colors identify individual income sources and outflow categories
within separate income, expense, saving, investment, and retirement families;
internal transfers are purple and dashed. Account/category filters retain the
complete relevant route instead of isolated graph edges.

Settings supports active-household switching, categories, members, reporting
exchange rates, and validated JSON export/import. The user backup exports the
user display name plus the current live Budget plan and reporting rates for
every accessible household; import restores the display name and each backup
household as a new household owned by the importing user. Credentials,
sessions, audit logs, deleted records, and Analyze source facts are not
included in a user backup.

Settings also lists active sessions. Revoke any session you no longer
recognize. Password reset revokes every active session. Public deployments can
require email verification before sign-in; the sign-in page links to
verification resend and password-reset request flows.

Accounts currently offer EUR, CHF, ZAR, USD, and GBP in the normal workflow.
Reference rates can be refreshed from Frankfurter's free, no-key institutional
reference-rate API. Rates are reporting inputs and do not predict destination
balances.

Account names, types, institutions, and masked statement references can be
edited without changing stable flow IDs. Account deletion is a soft delete:
active income allocations, planned transfers, or budget-item payment routes
must be reassigned or removed first. Analyze imports and actual transactions
remain linked to the deleted account for historical reporting.

An Essential budget item identifies required household spending for adherence
and future emergency-fund calculations. It does not change normalized totals.

Instance administrators use Platform settings for user management, household
tier assignment, S3-compatible platform backup uploads, audit-log CSV export,
and the protected platform-database reset. Reset preserves the current
administrator, current session, and append-only audit history while removing
other platform operational and financial data.

Scheduled platform backups and offline restore are documented in
`docs/operations/BACKUP_RESTORE.md`. Restore is destructive, replaces platform
data in one transaction, and revokes all sessions.

One-time items remain visible but are excluded from the recurring monthly
baseline. Unallocated income, account funds, and expenses without a funding
account must remain visible.

## Analyze

Analyze turns real statements into categorized, reconciled activity and
compares it to the Budget plan. It is available to Analyze and Optimize
households; Budget households see a locked overview.

1. **Import.** Upload a statement CSV and pick the account it belongs to.
   When a structured statement contains an explicit account IBAN/account-number
   field that uniquely matches a Budget account and currency route, Analyze
   suggests that route. IBANs found only in transaction or counterparty text
   are ignored for account matching.
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

Optimize is available to Optimize households and offers deterministic,
store-nothing tools that never change the budget:

1. **Scenarios.** Compare projection scenarios with explicit starting amount,
   monthly contribution, annual return, and horizon. It compounds an effective
   monthly rate and applies contributions at month end, excluding taxes and fees.
2. **Emergency fund.** Sizes a target from your Essential monthly spend times a
   chosen number of months of runway, then reports months covered, the gap, and
   a suggested monthly top-up. It can account for income protection — including a
   Swiss unemployment-insurance (ALV) preset (70%/80% of insured salary after a
   waiting period, once notice or severance ends) — which lowers the required
   reserve and explains by how much.
3. **Pillar 3a.** Uses the current-year Swiss maximum (CHF 7,258 with a pension
   fund, or 20% of net income up to CHF 36,288 without), shows remaining
   headroom and the tax saving at your marginal rate, and projects long-horizon
   growth.
4. **Advisor.** Ranks explainable recommendations that combine the
   emergency-fund gap, Pillar 3a headroom, and Analyze findings. Each cites the
   inputs it is based on and nothing is applied automatically.
5. **Debt payoff.** Compares avalanche (highest interest rate first) and
   snowball (smallest balance first) schedules from your balances, rates, and
   minimum payments plus any extra monthly payment, reporting time to debt-free,
   the debt-free date, total interest, and how much avalanche saves. Interest is
   nominal APR compounded monthly; it flags any debt whose minimum cannot cover
   its interest. Optimize-only — debt math never appears in Budget.
6. **Net worth.** Builds a point-in-time statement that totals your account
   balances, holdings at market value, and pension balances as assets, subtracts
   the debts you enter, and shows net worth in your reporting currency with a
   per-line and per-category reconciliation. Amounts in a currency with no stored
   reporting rate are flagged and excluded rather than mixed. Optimize-only;
   nothing is stored.

Accounts can be marked as a **spending** ("daily") account on the Accounts page; the money-flow graph highlights and groups spending accounts so shared accounts line up together. The graph also offers a **Pure budget** view that hides all accounts and transfers, showing income flowing straight to categories and budget items.
