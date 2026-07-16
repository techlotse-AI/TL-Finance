# Codex Instructions - TL Finance

You are building and maintaining **TL Finance**, a Docker-first,
privacy-focused, multi-currency household finance application.

Repository: `TL-Finance`

This is a full new-repository build. Do not copy source files, migrations, or
historical architecture from TL Finance Core. Prior projects may inform product
lessons, but this repository owns a new domain model, migration history, tests,
and documentation.

Read this file first every session. Then read the relevant `docs/**/*.md`
before changing load-bearing behavior.

---

## Product Contract

TL Finance has three progressively capable tiers:

| Tier | Scope |
| --- | --- |
| Budget | Planned income, payment-route accounts, transfers, budget items, and planned money-flow graph |
| Analyze | Statement imports, actual transactions, allocation, adherence, transfer/FX matching, cash, and money-leak discovery |
| Optimize | Forecasts, calculations, scenarios, recommendations, and predictions |

Release sequence:

| Version | Required outcome |
| --- | --- |
| v0.1.0 | Complete Budget tier and planned money-flow graph |
| v0.2.0 | Complete Analyze tier and budget adherence |
| v0.3.0 | Complete Optimize calculations, recommendations, and predictions |
| v0.4.0 | Full security audit and public-ready auth/operations |
| v0.5.0 | Versioned, vulnerability-gated Docker Hub releases |

Unavailable paid tiers remain visible as locked or "Coming later." Server-side
entitlements are authoritative; client-side hiding is never authorization.

For the shipped version, `VERSION`, `package.json`, and git tags are
authoritative (see `CLAUDE.md`) — do not hardcode a version here. As of this
writing Budget and Analyze are implemented, Optimize deterministic tools are
implemented, Phase D (emergency fund, financial goals, debt, net-worth) is
complete, and public-ready security and operations controls are implemented.
Tagged releases (`vX.Y.Z`) publish versioned containers only after the release
verification and container security gates.

---

## Locked Product Boundaries

### Budget

Budget accounts are planned payment-route containers only. Currency-specific
`AccountPocket` rows are the actual flow nodes. A single-currency account has
one pocket; a multi-currency account may have several.

Budget must not contain:

- Current balances
- Balance snapshots
- Net worth
- Forecasts
- Expected returns
- Future values
- Debt payoff calculations
- Actual transactions
- Statement imports
- Recommendations or predictions

Budget supports these account types:

```text
personal
savings
investment
retirement
credit_card
cash
other
```

Income sources route to one or more receiving account pockets.

Planned account transfers move money between household accounts and are not
income or spending.

Income allocations, planned transfers, and budget-item payment routes reference
account-pocket IDs. Do not add balances to accounts or pockets in Budget.

Expense budget items may have a paying account. Unallocated expense items remain
valid but must be visibly flagged.

Saving, investment, and retirement items require both a paid-from account and a
paid-to account. They are planned allocations, not spending.

The planned monthly money-flow graph must represent:

```text
Income Source
  -> Receiving Account
  -> Planned Account Transfers
  -> Destination Accounts
  -> Payment Category
  -> Budget Item
```

Graph totals must reconcile exactly to the normalized monthly budget table.
Internal transfers must never be double-counted.

### Monthly Normalization

Use Decimal arithmetic.

| Recurrence | Normalized monthly amount |
| --- | --- |
| weekly | `amount * 52 / 12` |
| monthly | `amount` |
| quarterly | `amount / 3` |
| yearly | `amount / 12` |
| custom selected months | `amount * selectedMonthCount / 12`; preserve selected months as metadata |
| once | show separately; exclude from recurring monthly baseline |

Do not add arbitrary per-month amount overrides in v0.1.0.

### Analyze

Analyze begins in v0.2.0 and owns:

- Statement import preview and commit
- Normalized actual transactions
- Original source-row preservation
- Category and budget-item allocation
- Split allocations
- Review queue
- Deterministic allocation rules
- Internal transfer and FX matching
- Cash allocation
- Planned-versus-actual adherence
- Actual/comparison money-flow graphs
- Deterministic money-leak findings

Unknown actual transactions must enter review. Never silently assign them to
"Other."

High-confidence transfer/FX matches may auto-confirm. Medium-confidence matches
require user confirmation. Low-confidence candidates remain unmatched.

ATM withdrawals are transfers into a Cash account. Users allocate subsequent
cash spending manually. Unallocated cash remains visible.

Use structured statement formats first. Do not implement PDF/OCR ingestion
before structured parsers are production-ready.

### Optimize

Optimize begins in v0.3.0 and owns:

- Account balance forecasts
- Savings and retirement projections
- Emergency-fund calculations
- Scenario comparison
- Swiss Pillar 3a calculations
- Explainable recommendations
- Optional privacy-safe AI recommendations

Optimize must not automatically change a user's budget. Raw transaction
descriptions, counterparties, and account identifiers must not be sent to an
external AI provider by default.

---

## Visual Style - Locked

`docs/design/UI_SPEC.md` is the source of truth.

Quick reference:

- Dark mode first
- Background `#0B0F14`
- Card `#0F151C`
- Muted surface `#161D27`
- Brand gradient `#7A3CFF` to `#00D1C7`, 135 degrees
- Inter typography
- 8px grid
- Maximum width 1200px
- Lucide line icons with consistent 1.5 stroke
- Radius 8px or less
- Technical, precise copy without marketing language

Use semantic Tailwind theme tokens. Do not hard-code raw hex values in
components.

Build the usable workflow as the first screen. Prefer tables and dense
operational lists over promotional cards. Charts require clear empty states,
reconciliation warnings, keyboard access, and tabular alternatives.

---

## Stack - Locked

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS and custom primitives
- PostgreSQL 16
- Prisma ORM
- Zod
- decimal.js
- Recharts or another React-compatible chart library with Sankey support
- Lucide React
- Node `crypto`
- Vitest
- ESLint
- Docker multi-stage build

**Exception:** `unpdf` (v0.9.5) — PDF text extraction for the FNB Private
Clients Current Account statement parser. Every other statement parser is
dependency-free by design (see `csv.ts`'s and `ofx.ts`'s own module doc
comments), but there is no dependency-free way to read a PDF's content
stream, and FNB's real emailed statement format is PDF, not CSV/OFX. `unpdf`
wraps PDF.js for serverless/Node runtimes with zero required runtime
dependencies of its own and no native binaries for text extraction (its only
peer dependency, a canvas renderer for page-image rendering, is optional and
unused here). Keep PDF parsers thin: extract text via `pdf.ts`, then do all
real parsing logic in a pure, fixture-testable function operating on that
text, exactly like `ofx.ts`'s tag/value reader.

Keep this as one application and one database schema. Do not introduce
microservices without measured evidence that the single-application design is
insufficient.

Pin exact dependency versions in the lockfile.

---

## Expected Code Layout

```text
src/
  middleware.ts
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

Keep module ownership clear:

| Module | Owns | Must not own |
| --- | --- | --- |
| Budget | Planned sources, accounts, transfers, categories, and items | Actual transactions or predictions |
| Analyze | Imported actuals, allocation, adherence, and reconciliation | Forecast calculations |
| Optimize | Scenarios, calculations, and recommendations | Raw statement parsing |

---

## Money Rules

- DB money: `Decimal @db.Decimal(18, 4)`
- DB percentages: `Decimal @db.Decimal(8, 6)` stored as decimal fractions
- Code arithmetic: decimal.js
- API and server/client wire format: strings
- Never persist money as `Float`
- Stay in Decimal until display
- Store native currency on every monetary row
- Convert only at explicit reporting boundaries
- Centralize exchange-rate lookup, caching, fallback, and stale warnings

Every graph and report must identify its reporting currency and reconcile to its
source rows.

---

## Tenancy and Authorization - Mandatory

The primary tenant boundary is `Household`. Users access households through
`HouseholdMember` roles:

```text
owner
admin
member
```

Every household-owned table contains `householdId`.

For every request:

1. Authenticate the session server-side.
2. Resolve the active household.
3. Verify household membership and required role/capability.
4. Scope every read and write by `householdId`.
5. Verify ownership of every client-supplied foreign key.

For `[id]` mutations, find the row with both `id` and `householdId` before
updating, or use household-scoped `updateMany`/`deleteMany` and verify the row
count.

Client-side entitlement state is presentational only. Every paid API route must
enforce its capability server-side.

---

## API Rules

- Validate every mutation body with Zod before touching Prisma.
- Use shared schemas for route and form contracts.
- Use database transactions for multi-row invariants.
- Route all errors through one production-safe API error handler.
- Never expose raw Prisma errors, stack traces, or secret values.
- Write append-only audit events for state changes.
- Hash or redact IP addresses before persistence.
- Return Decimal values as strings.
- Paginate unbounded lists.
- Avoid N+1 query patterns.

---

## Soft Delete and Audit

User financial records default to soft delete:

```text
active = false
deletedAt = now()
```

Live queries filter `deletedAt: null`.

Reject hard delete while referenced rows remain.

Every state-changing route writes an append-only audit event with:

- user
- household
- action
- resource type
- resource ID
- timestamp
- redacted or hashed request metadata

Never store raw IP addresses or secrets in audit data.

---

## Statement Ingestion Rules

These rules apply when v0.2.0 work begins.

Parser contract:

```ts
interface StatementParser {
  key: string;
  institution: StatementInstitution;
  version: string;
  detect(input: StatementInput): ParserDetection;
  parse(input: StatementInput): Promise<NormalizedStatement>;
}
```

Parser requirements:

1. Require at least two sanitized real fixtures before production-ready status.
2. Fail closed when dates, signs, currency, or account identity are ambiguous.
3. Never silently drop rows.
4. Return structured warnings and confidence.
5. Preserve source row JSON and parser version.
6. Reconcile statement balances when the source supports it.
7. Make preview write no transactions.
8. Make commit idempotent by file hash and row dedupe hash.
9. Batch writes; do not perform per-row Prisma mutations in parser loops.
10. Keep AI out of parsing, allocation, dedupe, transfer matching, and FX
    matching.

Initial parser priority:

```text
UBS account CSV
UBS card CSV
Revolut CSV
Zuger Kantonalbank structured export
FNB Private Clients Current Account (PDF statement) — shipped v0.9.5
Standard Bank structured export
Investec structured export
Frankly and VIAC contributions/withdrawals
Saxo contributions/withdrawals
```

Holdings and performance imports belong to Optimize, not Analyze.

---

## Security

Baseline security is required from v0.1.0:

- Strong password hashing
- Database-backed revocable sessions
- HTTP-only, secure, same-site cookies
- Tenant-scoped authorization
- Role and entitlement checks
- CSRF and trusted-origin checks for unsafe requests
- Authentication rate limits
- Mutation and security-event audit logs
- Sealed server-side secrets
- Safe security headers
- No secret or raw financial-data logging

v0.4.0 completes public-ready hardening:

- Full access-control and security audit
- Cross-household and privilege-escalation tests
- Email verification and password-reset delivery
- Session-management and forced revocation
- Secret rotation
- Backup scheduling and tested restore
- Dependency and container vulnerability review
- Threat model, incident response, privacy, and deployment documentation

Do not defer basic security until v0.4.0.

---

## Migrations

- Additive migrations only.
- Never edit a committed or released migration.
- Review generated SQL before applying it.
- CI must reject destructive migration statements unless an explicitly reviewed
  migration plan permits them.
- Update `docs/architecture/DATA_MODEL.md` and
  `docs/reference/DATABASE_SCHEMA.md` with schema changes.

---

## Testing

Test depth scales with risk and blast radius.

Minimum required coverage:

- Decimal money arithmetic
- Recurrence monthly normalization
- Graph reconciliation golden tests
- Zod validation
- Household isolation
- Foreign-key ownership
- Role and entitlement enforcement
- Audit emission
- Soft delete
- Parser golden fixtures when Analyze begins
- Import idempotency and dedupe
- Allocation reconciliation
- Transfer and FX matching
- Cash allocation
- Planned-versus-actual aggregation
- Optimize calculation golden tests when Optimize begins
- Public auth and security tests for v0.4.0

Before declaring work complete, run the relevant subset and always run:

```text
typecheck
lint
tests
production build
```

---

## Documentation

Required documents:

```text
README.md
AGENTS.md
docs/README.md
docs/architecture/ARCHITECTURE.md
docs/architecture/DATA_MODEL.md
docs/design/UI_SPEC.md
docs/operations/DEPLOYMENT.md
docs/operations/SECURITY.md
docs/product/USER_GUIDE.md
docs/reference/API.md
docs/reference/DATABASE_SCHEMA.md
docs/reference/DEFAULT_CATEGORIES.md
docs/strategy/ROADMAP.md
docs/strategy/STATEMENT_INGESTION.md
docs/strategy/TRANSFER_AND_FX_MATCHING.md
docs/release/CHANGELOG.md
```

Update relevant documentation in the same change as behavior. Documentation
must describe implemented behavior, not aspirations presented as complete.

---

## When Making a Change

1. Read `AGENTS.md` and relevant `docs/**/*.md`.
2. Confirm the change belongs to the active release and correct tier.
3. Preserve household scoping, ownership checks, entitlements, and audit.
4. Add or extend Zod schemas for API changes.
5. Add an additive Prisma migration for schema changes.
6. Keep money in Decimal and strings at boundaries.
7. Add focused tests, including access tests for household-owned resources.
8. Update documentation.
9. Run typecheck, lint, tests, and build.

---

## Do Not

- Copy source code or migrations from TL Finance Core.
- Add balances or predictions to Budget.
- Count account transfers, savings allocations, investments, retirement
  contributions, or FX exchanges as spending.
- Persist money as JS floats.
- Trust client-supplied household IDs, roles, or entitlements.
- Write unscoped household queries.
- Attach a foreign key without verifying household ownership.
- Edit a past migration.
- Return raw production errors.
- Store raw IP addresses or secrets.
- Hard-delete referenced financial rows.
- Silently classify unknown actual transactions as "Other."
- Use AI for deterministic financial data processing.
- Send raw transaction descriptions to AI by default.
- Auto-apply Optimize recommendations.
- Introduce microservices without measured need.
- Present future roadmap behavior as already implemented.
