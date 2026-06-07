# TL Finance - New Repository Build Prompt

## Role

You are the lead engineer building a new product named **TL Finance** in a new
repository named **`TL-Finance`**.

Build the application from scratch. Do not copy source code, migrations, or
historical implementation details from TL Finance Core. The existing project may
be used only as a conceptual reference for product lessons, security patterns,
and visual direction.

The result must be a Docker-first, multi-currency household finance application
with three progressively capable tiers:

| Tier | Promise |
| --- | --- |
| Budget | Plan where monthly income goes, including account routing, expenses, savings, investments, and retirement contributions |
| Analyze | Import actual financial activity, reconcile it, allocate it to the plan, and measure budget adherence |
| Optimize | Calculate future scenarios, identify improvements, and produce explainable recommendations and predictions |

The visual style remains the TL Finance Core visual style, but the domain model,
repository history, migrations, and implementation must be new.

## Authoritative Product Decisions

Treat these decisions as locked unless the product owner explicitly changes
them:

1. Build a completely new repository and all code from scratch.
2. Use one application and one database schema with tier entitlements.
3. Keep the product source-available, privacy-focused, self-hostable, and
   Docker-first.
4. Support households with multiple members and `owner`, `admin`, and `member`
   roles.
5. Start with manual administrator tier assignment. Prepare clean billing
   interfaces, but do not implement payment-provider integration initially.
6. Ship Swiss and generic presets. Swiss is the first fully supported country
   profile.
7. Paid tiers are visible in navigation when unavailable, with a clear locked
   or "Coming later" state. Locked pages must not expose paid data or execute
   paid calculations.
8. Budget accounts represent planned payment routes only. Budget does not track
   current balances and does not predict future balances.
9. Analyze may retain source statement balance values for import reconciliation,
   but these values must not turn Budget accounts into balance-tracking
   accounts.
10. Optimize never changes a user's plan automatically. Every proposed change
    requires explicit user approval.
11. Raw transaction descriptions, counterparties, and account identifiers must
    not be sent to an external AI provider by default.

## Release Plan

### v0.1.0 - Complete Budget Tier

Ship the complete free Budget tier, including the monthly money-flow graph.

### v0.2.0 - Complete Analyze Tier

Ship statement ingestion, normalized actual transactions, allocation, transfer
and FX matching, cash handling, money-leak discovery, and budget adherence.

### v0.3.0 - Complete Optimize Tier

Ship calculations, recommendations, scenarios, forecasts, and predictions.

### v0.4.0 - Public-Ready Security

Complete a full security audit and ship hardened public-ready authentication,
authorization, deployment, backup, observability, and operational controls.

Baseline security, tenant isolation, safe authentication, auditability, and
input validation are mandatory from v0.1.0. v0.4.0 is the final hardening and
independent-review release, not permission to defer basic security.

## Product Modules

### Budget Tier

Budget answers:

- What income do we expect each month?
- Which account receives each income source?
- Which planned transfers move money between our accounts?
- Which account pays each expense?
- Which account funds each savings, investment, or retirement contribution?
- Where does each contribution go?
- How is expected monthly income allocated?

Budget includes:

- Household setup and member roles
- Base currency and additional currencies
- Swiss and generic category presets
- User-managed category groups and categories
- Income sources
- Payment-route accounts
- Planned account transfers
- Budget items
- Monthly normalized plan totals
- Tabular and graphical plan views
- Monthly Sankey-style money-flow visualization
- JSON household export and import

Budget explicitly excludes:

- Statement imports
- Actual transactions
- Current account balances
- Net worth
- Future account values
- Forecasts
- Investment growth
- Debt payoff calculations
- Recommendations
- Predictions

### Analyze Tier

Analyze answers:

- What actually happened?
- Which planned budget item does each actual transaction belong to?
- Are we adhering to the plan?
- Which movements are transfers or currency exchanges rather than spending?
- Where is cash going?
- Which recurring costs, fees, subscriptions, or unplanned purchases are money
  leaks?

Analyze includes:

- File-based statement import
- Import preview before commit
- Institution and format detection
- Normalized actual-transaction ledger
- Original-row preservation for transparency
- Deterministic deduplication and idempotent re-import
- Category and budget-item allocation
- Split allocation across multiple budget items
- Merchant and description rules learned from user confirmations
- Review queue for unknown or ambiguous transactions
- Internal transfer matching
- Cross-currency exchange matching
- Cash account allocation and manual cash transactions
- Planned-versus-actual reporting by item and category
- Actual and comparison money-flow graphs
- Recurring subscription and fee detection
- Merchant and spending trends
- Deterministic money-leak findings

Initial statement-support priority:

1. UBS account CSV and UBS card CSV
2. Revolut CSV
3. Zuger Kantonalbank structured export
4. FNB CSV
5. Standard Bank structured export
6. Investec structured export
7. Frankly and VIAC contribution/withdrawal exports
8. Saxo contribution/withdrawal exports

Use structured formats first. PDF and OCR ingestion are out of scope until
structured import accuracy is established. Holdings and investment-performance
imports are Optimize concerns, not Analyze v0.2.0 concerns.

### Optimize Tier

Optimize answers:

- What is likely to happen if the current plan continues?
- Which plan changes improve liquidity, saving, investing, or retirement
  outcomes?
- What trade-offs exist between scenarios?
- Which recommendations are supported by the user's actual data?

Optimize includes:

- Account balance forecasts
- Savings and retirement projections
- Budget optimization recommendations
- Emergency-fund calculations
- Scenario comparison
- Swiss Pillar 3a calculations
- Subscription and fee optimization
- Explainable deterministic recommendations
- Privacy-safe optional AI recommendations using aggregate-only payloads

Optimize must remain visible as locked or "Coming later" before v0.3.0. No
forecast or optimization implementation belongs in v0.1.0 or v0.2.0.

## Budget Domain Model

Use PostgreSQL and Prisma with additive migrations. The following describes the
minimum domain shape; implementation names may differ only when the replacement
is clearer and documented.

### Identity and Tenancy

- `User`
- `Session`
- `Household`
- `HouseholdMember`
- `EmailVerificationToken`
- `PasswordResetToken`
- `TierEntitlement`

Every household-owned row must contain `householdId`. Every request must resolve
the active household and verify membership before reading or mutating data.

### Categories

- `CategoryGroup`
  - `householdId`
  - `name`
  - `sortOrder`
  - `active`
  - `deletedAt`
- `Category`
  - `householdId`
  - `groupId`
  - `name`
  - `kind`: `income`, `expense`, `saving`, `investment`, `retirement`
  - `essential`
  - `sortOrder`
  - `active`
  - `deletedAt`

Swiss presets must include local concepts such as Pillar 3a, Quellensteuer,
Nebenkosten, Serafe, health insurance, and Swiss public transport while
remaining editable after onboarding.

### Accounts and Currency Pockets

`Account` is an institution-level planned payment-route container, not a
balance or forecast object. `AccountPocket` is the currency-specific flow node
used by income allocations, transfers, and budget items. A normal
single-currency account has one pocket; a multi-currency account such as
Revolut may have several.

Required account types:

- `personal`
- `savings`
- `investment`
- `retirement`
- `credit_card`
- `cash`
- `other`

Minimum fields:

- `householdId`
- `name`
- `type`
- `institution`
- optional masked reference for statement matching
- `active`
- `deletedAt`

`AccountPocket` minimum fields:

- `householdId`
- `accountId`
- `name`
- ISO currency
- `active`
- `deletedAt`

All planned flow relationships reference account-pocket IDs. The UI may display
the parent account name and pocket currency as one account node when that is
clearer.

Do not add `currentBalance`, `openingBalance`, forecast rate, expected return,
or future value fields to accounts or pockets in v0.1.0.

### Income Sources

`IncomeSource` represents expected income and must route to one or more accounts.

Minimum fields:

- `householdId`
- `name`
- `categoryId`
- `amount`
- `currency`
- recurrence
- start and optional end date
- `active`
- `deletedAt`

Use `IncomeAllocation` rows to split an income source across receiving account
pockets by fixed amount or percentage. Validate that allocations reconcile
exactly to the source amount. When an allocation crosses currencies, preserve
the source allocation amount and use the centralized reporting FX rate rather
than storing a predicted destination balance.

### Planned Account Transfers

`PlannedAccountTransfer` represents money moving between two household accounts.
It is neither income nor spending.

Minimum fields:

- `householdId`
- `name`
- `fromAccountPocketId`
- `toAccountPocketId`
- `amount`
- `currency`
- recurrence
- start and optional end date
- `active`
- `deletedAt`

Reject transfers where source and destination are the same pocket. Validate
ownership of both pocket IDs and their parent accounts. Cross-currency planned
transfers are permitted, but are still route allocations rather than forecasts.

### Budget Items

`BudgetItem` represents a planned use of money.

Minimum fields:

- `householdId`
- `name`
- `categoryId`
- `kind`: `expense`, `saving`, `investment`, `retirement`
- `amount`
- `currency`
- recurrence
- `paidFromAccountPocketId`
- optional `paidToAccountPocketId`
- start and optional end date
- `essential`
- `active`
- `deletedAt`

Rules:

- Expense items may omit `paidFromAccountPocketId`, but the UI must visibly
  flag them as unallocated.
- Saving, investment, and retirement items require both
  `paidFromAccountPocketId` and `paidToAccountPocketId`.
- Source and destination pockets must differ.
- A contribution routed to another household account is an allocation, not
  spending.

### Recurrence and Monthly Normalization

Support:

- once
- weekly
- monthly
- quarterly
- yearly
- custom selected months

Do not support arbitrary amount overrides per calendar month in v0.1.0.

Use Decimal arithmetic and these monthly-normalization rules:

| Recurrence | Normalized monthly amount |
| --- | --- |
| weekly | `amount * 52 / 12` |
| monthly | `amount` |
| quarterly | `amount / 3` |
| yearly | `amount / 12` |
| custom selected months | `amount * selectedMonthCount / 12`, while preserving selected months as metadata |
| once | shown separately as a one-time item and excluded from the recurring monthly baseline |

Annual costs must therefore appear as an even monthly provision. Weekly costs
must be annualized and divided into a stable monthly amount rather than varying
by the number of weekdays in each calendar month.

## Monthly Money-Flow Graph

Build an interactive Sankey-style graph for v0.1.0. The graph is a core Budget
workflow, not a decorative dashboard widget.

The conceptual flow is:

```text
Income Source
  -> Receiving Account
  -> Planned Account Transfers
  -> Destination Accounts
  -> Payment Category
  -> Budget Item
```

Clarifications:

- An account with no intervening transfer may flow directly to a payment
  category.
- Planned transfers render as account-to-account flow edges. The graph may use
  a transfer stage or transfer-labelled edges, but users must be able to see
  both source and destination accounts.
- Expense items terminate at the budget item.
- Saving, investment, and retirement items continue from their funding account
  through their category/item to the destination account, or otherwise make the
  destination account clearly visible without double-counting the flow.
- Graph totals must reconcile to the normalized monthly table.
- Do not count an internal transfer as spending.
- Detect and visibly surface unallocated income, unallocated account funds, and
  budget items without a funding account.

Graph interactions:

- Filter by month context, account, category, and currency.
- Hover or focus shows native amount, base-currency amount, and percentage of
  total income.
- Clicking a node filters or opens the relevant income source, account,
  category, transfer, or budget item.
- Support keyboard navigation and a table-based accessible alternative.
- Render a clear empty state and reconciliation warnings.

Budget sees planned flows only. Analyze adds actual and planned-versus-actual
views in v0.2.0.

## Analyze Domain Model

Add these models in v0.2.0 through new additive migrations:

### Statement Imports

`StatementImport` records one previewed or committed file:

- household and optional linked account
- original filename
- content hash
- parser key and parser version
- detected institution
- status
- row, imported, duplicate, and warning counts
- structured warnings
- created and committed timestamps
- optional encrypted source-file retention metadata

Imports must be idempotent by household and content hash. Preview must not write
transactions.

### Actual Transactions

`ActualTransaction` stores normalized immutable source facts plus separate user
corrections:

- household, import, and optional account pocket
- booking and optional value date
- signed amount and currency
- description
- counterparty
- reference
- optional source `balanceAfter` for reconciliation only
- normalized merchant key
- source institution
- parser version
- original raw row JSON
- dedupe hash
- review state
- hidden/ignored state

Positive values are inflows. Negative values are outflows. Never mutate the
original parsed values when a user corrects a transaction; store overrides or
allocations separately and preserve the source row.

### Actual Allocations

`ActualTransactionAllocation` assigns all or part of a transaction to a
category and budget item:

- household
- transaction
- category
- optional budget item
- signed allocated amount
- allocation source: `rule`, `manual`, `cash`, or `system`
- confirmed state

Allocation rows for a transaction must reconcile exactly to the transaction
amount, except while explicitly in a partially allocated review state.

### Rules

`TransactionAllocationRule` stores deterministic household-scoped rules:

- match field and match type
- normalized pattern
- optional institution scope
- category and optional budget item target
- priority
- active state

Unknown transactions must enter the review queue. Never silently classify
unknown rows as "Other."

### Transfer and FX Matches

`TransactionTransferMatch` links actual debit and credit rows representing the
same internal movement.

Required behavior:

- Auto-confirm high-confidence matches.
- Ask users to confirm medium-confidence matches.
- Leave low-confidence matches unmatched.
- Never match across households.
- Exclude confirmed matches from income, spending, and adherence totals.
- Match same-currency transfers by amount, date, reference, counterparty, and
  account evidence.
- Match FX legs using a statement-provided exchange rate when available,
  otherwise the booking-date exchange rate.

### Cash

Cash is represented by `cash` accounts.

- An ATM withdrawal is matched as a transfer into a Cash account, not spending.
- Users can create manual cash-spending transactions.
- Users can split cash spending across budget items.
- Unallocated cash remains visible.
- Cash allocations affect budget adherence.

## Statement Parser Architecture

Use a parser registry with a strict contract:

```ts
interface StatementParser {
  key: string;
  institution: StatementInstitution;
  version: string;
  detect(input: StatementInput): ParserDetection;
  parse(input: StatementInput): Promise<NormalizedStatement>;
}
```

Rules:

1. Build each parser from at least two sanitized real fixtures.
2. Fail closed when dates, signs, currency, or account identity cannot be
   inferred.
3. Never silently drop a source row.
4. Return warnings and confidence.
5. Preserve original row JSON and parser version.
6. Reconcile opening balance plus row movements to closing balance when the
   source format supports it.
7. Use streaming or bounded parsing where practical.
8. Parse in Node runtime, not Edge middleware.
9. Batch database writes.
10. Test 1k, 10k, and 50k row paths.

Suggested layout:

```text
src/lib/statements/
  types.ts
  registry.ts
  detect.ts
  normalize.ts
  dedupe.ts
  allocation-rules.ts
  transfer-match.ts
  fx-match.ts
  parsers/
```

Do not use AI for statement parsing, deduplication, transfer matching, or
allocation. These must remain deterministic and reviewable.

## Analyze Outputs

v0.2.0 must ship:

- Planned versus actual by budget item
- Planned versus actual by category
- Planned, actual, and comparison money-flow graphs
- Income, spending, saving, and investing totals
- Unallocated transaction queue
- Unallocated cash view
- Transfer and FX reconciliation view
- Recurring subscription detection
- Merchant and spending trends
- Deterministic money-leak findings

Money-leak findings may include:

- Repeated unplanned purchases
- Subscription growth
- Duplicate subscriptions
- Bank-fee drag
- Repeated budget overruns
- High unallocated cash withdrawals
- New recurring merchants

Every finding must cite the aggregate or transaction set that caused it. Do not
present findings as regulated financial advice.

## Optimize Rules

v0.3.0 may add balance, return, rate, scenario, and projection concepts through
new migrations. Keep Optimize calculations isolated from Budget and Analyze.

Rules:

- Deterministic calculations exist independently of AI.
- Forecasts operate per account and currency.
- FX conversion happens only at an explicit reporting boundary.
- Persist money as Decimal and return money as strings.
- Every recommendation includes rationale, inputs, confidence, and limitations.
- AI receives aggregate-only payloads by default.
- Users explicitly approve any plan changes suggested by Optimize.

## Tier Entitlements

Use server-side entitlements. Client-side hiding is not authorization.

Suggested capabilities:

```text
budget.read
budget.write
analysis.read
analysis.write
optimize.read
optimize.run
admin.tiers.manage
```

Rules:

- Budget capabilities are available to every active household.
- Analyze requires the Analyze or Optimize tier.
- Optimize requires the Optimize tier.
- Unavailable modules remain visible as locked or "Coming later."
- API routes return a consistent entitlement error without leaking protected
  information.
- Manual administrator assignment is the initial entitlement source.
- Define a billing-provider interface but do not integrate a provider before it
  is requested.

## Visual Specification

Use the TL Finance visual style:

| Rule | Value |
| --- | --- |
| Dark background | `#0B0F14` |
| Card | `#0F151C` |
| Muted surface | `#161D27` |
| Brand gradient | `#7A3CFF` to `#00D1C7`, 135 degrees |
| Typography | Inter |
| Layout | 8px grid, maximum width 1200px |
| Icons | Lucide line icons, consistent 1.5 stroke |
| Radius | 8px or less |
| Tone | Technical, precise, no marketing copy |

Create semantic Tailwind theme tokens. Do not hard-code raw hex values inside
components.

UI rules:

- Dark mode is first-class.
- Build the usable workflow as the first screen.
- Prefer tables and dense operational lists over promotional cards.
- Use reusable primitives for buttons, inputs, selects, dialogs, switches,
  badges, tables, and form fields.
- Server components fetch and serialize plain rows; client components own
  interaction state.
- Decimal values cross server/client and API boundaries as strings.
- Charts must have empty states, reconciliation states, and accessible tabular
  alternatives.
- Color must never be the only signal.

## Technical Architecture

Use:

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS with custom primitives
- PostgreSQL 16
- Prisma ORM
- Zod
- decimal.js
- Recharts or another React-compatible chart library with Sankey support
- Lucide React
- Node `crypto`
- Docker multi-stage builds
- Vitest
- ESLint

Pin exact dependency versions in the lockfile. Do not introduce a second API
service or microservices before demonstrated scale requires them.

Suggested repository layout:

```text
src/
  app/
    api/
    admin/
    budget/
    accounts/
    transfers/
    analysis/
    optimize/
    settings/
  components/
    ui/
    charts/
  lib/
    auth/
    audit/
    entitlements/
    money/
    budget/
    statements/
    analysis/
    optimize/
    country-profiles/
  middleware.ts
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  architecture/
  design/
  operations/
  product/
  reference/
  strategy/
  release/
```

### Initial Route Surface

v0.1.0 pages:

```text
/                         planned monthly overview and money-flow graph
/onboarding               household, base currency, members, and preset
/income                   income sources and receiving-pocket allocations
/accounts                 account containers and currency pockets
/transfers                planned account-pocket transfers
/budget                   budget-item table and editor
/settings                 household, categories, members, tier, export/import
/analysis                 locked / coming-later Analyze surface
/optimize                 locked / coming-later Optimize surface
/admin                    instance and manual tier administration
/signin
/signup
```

v0.1.0 API groups:

```text
/api/auth/*
/api/household/*
/api/members/*
/api/category-groups/*
/api/categories/*
/api/accounts/*
/api/account-pockets/*
/api/income-sources/*
/api/income-allocations/*
/api/planned-transfers/*
/api/budget-items/*
/api/budget/monthly-summary
/api/budget/money-flow
/api/entitlements
/api/household/export
/api/household/import
/api/admin/tiers/*
/api/health
```

Add Analyze and Optimize routes only in their release phases. Locked page
surfaces may exist earlier, but their protected API behavior must not.

### v0.1.0 Build Sequence

Implement v0.1.0 in this order:

1. Repository, Docker, PostgreSQL, Prisma, lint, test, CI, and documentation
   foundations.
2. Authentication, sessions, household tenancy, membership roles, audit, and
   baseline security.
3. Onboarding, country/category presets, and active-household selection.
4. Account containers and currency pockets with no balance fields.
5. Income sources and reconciled receiving-pocket allocations.
6. Planned account-pocket transfers.
7. Budget items and recurrence normalization.
8. Monthly summary and reconciliation engine.
9. Sankey money-flow graph and accessible table fallback.
10. Locked Analyze/Optimize surfaces and manual tier administration.
11. Household export/import, release documentation, and complete verification.

## Money and Currency Rules

- Persist money as `Decimal @db.Decimal(18, 4)`.
- Persist percentage fractions as `Decimal @db.Decimal(8, 6)`.
- Never persist monetary values as `Float`.
- Use decimal.js for arithmetic.
- Stay in Decimal until display.
- Return money through APIs as strings.
- Store each item in its native currency.
- Convert only at explicit reporting boundaries.
- Centralize exchange-rate lookup, caching, fallback, and stale-rate warnings.
- Graph and report totals must expose their reporting currency and conversion
  date/rate source.

## API and Mutation Rules

- Validate every mutation body with Zod before touching the database.
- Resolve the authenticated user and active household server-side.
- Scope every household query by `householdId`.
- Verify ownership of every client-supplied foreign key before writing.
- Use transactions for multi-row invariants.
- Route all errors through one production-safe API error handler.
- Never return raw Prisma errors or production stack traces.
- Write append-only audit events for state changes.
- Hash or redact IP addresses before persistence.
- Use soft delete for user financial records.
- Reject hard deletion while referenced rows remain.

## Authentication and Security

### Baseline from v0.1.0

- Email and password authentication
- Strong password hashing
- Database-backed revocable sessions
- HTTP-only, secure, same-site cookies
- Tenant-scoped authorization
- Role checks
- Safe origin and CSRF protection for unsafe requests
- Rate limiting on authentication endpoints
- Audit log for mutations and security events
- Sealed server-side secrets
- No raw secrets in logs
- Security headers
- Health endpoint that exposes no sensitive details

### v0.4.0 Public-Ready Hardening

- Independent access-control and security review
- Complete cross-household access test suite
- Email verification and password-reset delivery
- Session-management UI and forced revocation
- Admin role-management review
- Abuse and rate-limit review
- Dependency and container vulnerability review
- Secret rotation flow
- Backup scheduling and tested restore runbook
- Audit retention and export
- Production deployment checklist
- Threat model
- Incident-response and disclosure documentation
- Public-ready legal and privacy documentation

## Testing and CI

Required tests:

- Unit tests for Decimal money and recurrence normalization
- Graph reconciliation golden tests
- API validation tests
- Tenant-isolation integration tests
- Entitlement tests
- Role/access tests
- Household foreign-key ownership tests
- Parser golden-fixture tests
- Import idempotency and dedupe tests
- Allocation reconciliation tests
- Transfer and FX matching tests
- Cash-allocation tests
- Planned-versus-actual aggregation tests
- Optimize calculation golden tests when v0.3.0 starts
- Authentication and public-readiness tests for v0.4.0

Required CI checks:

```text
generate
typecheck
lint
unit tests
access integration tests
migration safety checks
security checks
production build
container build
```

Migrations are additive. Never edit a migration that has been committed or
released.

## Version Acceptance Criteria

### v0.1.0

- A new user can create a household with Swiss or generic categories.
- The user can create all required account types and currency pockets without
  entering balances.
- The user can create income sources and reconcile their account allocations.
- The user can create planned account transfers.
- The user can create expenses, savings, investments, and retirement items.
- Savings, investment, and retirement items route from one account to another.
- Monthly normalization follows the locked recurrence rules.
- Budget tables and Sankey graph reconcile exactly.
- Transfers are not counted as spending.
- Unallocated flows are visible.
- Analyze and Optimize appear as locked or coming later.
- Tenant isolation, audit, typecheck, lint, tests, and build pass.

### v0.2.0

- Supported structured statements preview before commit.
- Imports are idempotent and preserve source rows.
- Unknown rows enter a review queue.
- Actual rows can be split and allocated to budget items.
- Cash withdrawals and cash spending are handled without double-counting.
- High-confidence transfers and FX exchanges match automatically.
- Medium-confidence matches require confirmation.
- Planned-versus-actual results reconcile.
- Actual and comparison Sankey graphs reconcile.
- Deterministic money-leak findings cite supporting data.
- 50k-row household analysis remains usable and paginated.

### v0.3.0

- Optimize calculations are deterministic and covered by golden tests.
- Forecasts and scenarios remain isolated from Budget/Analyze source facts.
- Recommendations are explainable and never auto-apply.
- Swiss Pillar 3a and emergency-fund calculations are documented.
- Optional AI receives aggregate-only data by default.
- Locked Optimize surfaces become functional only for entitled households.

### v0.4.0

- Full public-ready security checklist passes.
- Cross-household and privilege-escalation tests pass.
- Public auth, verification, reset, session revocation, and rate limits pass.
- Backup and restore are tested.
- Threat model, deployment, incident, privacy, and operations docs are complete.
- Production image and dependency scans meet the documented release threshold.

## Required Documentation

Create and maintain:

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/DATA_MODEL.md`
- `docs/design/UI_SPEC.md`
- `docs/operations/DEPLOYMENT.md`
- `docs/operations/SECURITY.md`
- `docs/product/USER_GUIDE.md`
- `docs/reference/API.md`
- `docs/reference/DATABASE_SCHEMA.md`
- `docs/reference/DEFAULT_CATEGORIES.md`
- `docs/strategy/ROADMAP.md`
- `docs/strategy/STATEMENT_INGESTION.md`
- `docs/strategy/TRANSFER_AND_FX_MATCHING.md`
- `docs/release/CHANGELOG.md`

Update relevant documentation in the same change as behavior.

## Explicit Non-Goals

- Do not copy the TL Finance Core codebase.
- Do not import the TL Finance Core migration history.
- Do not build microservices.
- Do not build direct bank API connections before structured file ingestion is
  production-ready.
- Do not use PDF/OCR as an initial statement format.
- Do not put balances, forecasts, rates of return, or future values in Budget.
- Do not put investment holdings or performance analysis in Analyze v0.2.0.
- Do not use AI for parsing, categorization, transfer matching, or calculations.
- Do not send raw financial descriptions to AI by default.
- Do not auto-apply optimization recommendations.
- Do not silently classify unknown actual transactions as "Other."
- Do not count internal transfers or FX exchanges as income or spending.

## Execution Instructions

1. Initialize the new repository with the stack, formatting, linting, test, and
   Docker foundations.
2. Add `AGENTS.md` and the required documentation skeleton before implementing
   load-bearing behavior.
3. Implement v0.1.0 end to end before starting Analyze.
4. Treat graph reconciliation, Decimal correctness, tenant isolation, and audit
   coverage as release blockers.
5. Keep migrations additive and versioned.
6. Implement supported statement parsers only after sanitized fixtures exist.
7. Keep future-tier interfaces visible but server-gated.
8. Run all relevant checks before declaring each release complete.

The build is complete only when all acceptance criteria for the active target
version pass and the corresponding documentation describes the implemented
behavior accurately.
