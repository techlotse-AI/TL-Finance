# AGENTS.md — TL Finance engineering rules

TL Finance is a Docker-first, privacy-focused, multi-currency household finance
application. This file is the canonical rule set for anyone, human or agent,
changing the repository. Read it first every session, then the relevant
`docs/**/*.md` before changing load-bearing behaviour.

What has shipped is recorded in `VERSION`, `CHANGELOG.md` and git tags. What is
planned is in `docs/strategy/ROADMAP.md`. Do not hardcode version or status
here.

---

## Product Contract

Three progressively capable tiers:

| Tier | Owns | Must not own |
| --- | --- | --- |
| Budget | Planned income, payment-route accounts, transfers, categories, budget items, planned money-flow graph | Actual transactions, balances, predictions |
| Analyze | Statement imports, actual transactions, allocation, adherence, transfer/FX matching, cash, money-leak findings | Forecast calculations |
| Optimize | Forecasts, calculations, scenarios, recommendations, predictions, holdings and performance imports | Raw statement parsing |

The three tiers are an architectural and functional split of the product
surface, not a paywall: from sprint 1 (2026-09-25, see
`docs/strategy/ROADMAP.md`) every household is served the Optimize tier
regardless of its stored entitlement, so locked pages and upgrade wording are
off the surface. The entitlement checks, the `TierEntitlement` model, and the
admin entitlement API are unchanged in the codebase for a possible later
return (`src/lib/entitlements/capabilities.ts`'s `resolveEffectiveTier`).
Server-side entitlements are authoritative; client-side hiding is never
authorization.

---

## Locked Product Boundaries

### Budget

Budget accounts are planned payment-route containers only. Currency-specific
`AccountPocket` rows are the actual flow nodes. A single-currency account has
one pocket; a multi-currency account may have several.

Budget must not contain: current balances, balance snapshots, net worth,
forecasts, expected returns, future values, debt payoff calculations, actual
transactions, statement imports, recommendations or predictions.

Account types: `personal`, `savings`, `investment`, `retirement`,
`credit_card`, `cash`, `other`.

Income sources route to one or more receiving account pockets. Planned account
transfers move money between household accounts and are not income or
spending. Income allocations, planned transfers, and budget-item payment routes
reference account-pocket IDs.

Expense budget items may have a paying account. Unallocated expense items remain
valid but must be visibly flagged. Saving, investment, and retirement items
require both a paid-from and a paid-to account; they are planned allocations,
not spending.

The planned monthly money-flow graph represents:

```text
Income Source -> Receiving Account -> Planned Account Transfers
              -> Destination Accounts -> Payment Category -> Budget Item
```

Graph totals must reconcile to the normalized monthly budget table (whole-amount
budget: figures presented rounded to the nearest 5, reconciliation tolerates
±5, stored money stays exact; see `src/lib/money/rounding.ts`). Internal
transfers must never be double-counted.

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

No arbitrary per-month amount overrides.

### Analyze

Owns statement import preview and commit, normalized actual transactions,
original source-row preservation, category and budget-item allocation, split
allocations, the review queue, deterministic allocation rules, internal
transfer and FX matching, cash allocation, planned-versus-actual adherence,
actual and comparison money-flow graphs, and deterministic money-leak findings.

- Unknown actual transactions must enter review. Never silently assign them to
  "Other."
- High-confidence transfer/FX matches may auto-confirm. Medium-confidence
  matches require user confirmation. Low-confidence candidates remain
  unmatched. Confirmed matches are excluded from income, spending and
  adherence totals.
- ATM withdrawals are transfers into a Cash account. Users allocate subsequent
  cash spending manually. Unallocated cash remains visible.
- Structured statement formats first. PDF ingestion is allowed only where an
  institution's real workflow is PDF and the structured parsers are already
  production-ready; no OCR.

### Optimize

Owns account balance forecasts, savings and retirement projections,
emergency-fund calculations, scenario comparison, Swiss pension calculations
(AHV, pillars 2/3a/3b), holdings and net worth, goals, debt payoff, explainable
recommendations, and optional privacy-safe AI recommendations.

Optimize must not automatically change a user's budget. Every output cites its
inputs. Raw transaction descriptions, counterparties, and account identifiers
must not be sent to an external AI provider by default.

---

## Visual Style — Locked

`docs/design/UI_SPEC.md` is the source of truth; `STYLING.md` is the quick
reference. Dark mode first, semantic Tailwind theme tokens only (no raw hex in
components), dense operational tables over promotional cards, and every chart
has an empty state, reconciliation warnings, keyboard access, and a tabular
alternative.

---

## Stack — Locked

Next.js App Router, React, TypeScript strict mode, Tailwind CSS and custom
primitives, PostgreSQL 16, Prisma ORM, Zod, decimal.js, Recharts (or another
React chart library with Sankey support), Lucide React, Node `crypto`, Vitest,
ESLint, Docker multi-stage build.

**Exception:** `unpdf` for PDF text extraction in statement parsers. Every
other parser is dependency-free by design; there is no dependency-free way to
read a PDF content stream. Keep PDF parsers thin: extract text via
`src/lib/statements/pdf.ts`, then do all parsing in a pure, fixture-testable
function over that text.

One application, one database schema. No microservices without measured
evidence that the single-application design is insufficient. Pin exact
dependency versions in the lockfile.

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

## Tenancy and Authorization — Mandatory

The primary tenant boundary is `Household`. Users access households through
`HouseholdMember` roles: `owner`, `admin`, `member`. Every household-owned table
contains `householdId`.

For every request:

1. Authenticate the session server-side.
2. Resolve the active household.
3. Verify household membership and required role/capability.
4. Scope every read and write by `householdId`.
5. Verify ownership of every client-supplied foreign key.

For `[id]` mutations, find the row with both `id` and `householdId` before
updating, or use household-scoped `updateMany`/`deleteMany` and verify the row
count. Every paid API route enforces its capability server-side.

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

User financial records default to soft delete (`active = false`,
`deletedAt = now()`). Live queries filter `deletedAt: null`. Reject hard delete
while referenced rows remain.

Every state-changing route writes an append-only audit event with user,
household, action, resource type, resource ID, timestamp, and redacted or
hashed request metadata. Never store raw IP addresses or secrets in audit data.

---

## Statement Ingestion Rules

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

1. Require at least two sanitized real fixtures before production-ready status.
   Real statements are used locally only and never committed; fixtures carry
   fabricated identities.
2. Fail closed when dates, signs, currency, or account identity are ambiguous.
3. Never silently drop rows.
4. Return structured warnings and confidence.
5. Preserve source row JSON and parser version.
6. Reconcile statement balances when the source supports it.
7. Preview writes no transactions.
8. Commit is idempotent by file hash and row dedupe hash.
9. Batch writes; no per-row Prisma mutations in parser loops.
10. Keep AI out of parsing, allocation, dedupe, transfer matching, and FX
    matching.

Shipped and pending parsers are listed in `src/lib/statements/parsers/index.ts`
and `docs/strategy/ROADMAP.md`.

---

## Security

Required at all times:

- Strong password hashing; TOTP secrets encrypted at rest, everything else
  hashed
- Database-backed revocable sessions; HTTP-only, secure, same-site cookies
- Tenant-scoped authorization with role and entitlement checks
- CSRF and trusted-origin checks for unsafe requests
- Authentication rate limits and account lockout with escalating backoff
- Mutation and security-event audit logs
- Sealed server-side secrets; safe security headers
- No secret or raw financial-data logging
- Email verification and password-reset delivery; password reset revokes all
  sessions
- Secret rotation, backup scheduling, and tested restore
- Cross-household and privilege-escalation tests
- Dependency and container vulnerability review (Trivy gate on releases)

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

Test depth scales with risk and blast radius. Minimum required coverage:
Decimal money arithmetic; recurrence normalization; graph reconciliation golden
tests; Zod validation; household isolation; foreign-key ownership; role and
entitlement enforcement; audit emission; soft delete; parser golden fixtures;
import idempotency and dedupe; allocation reconciliation; transfer and FX
matching; cash allocation; planned-versus-actual aggregation; Optimize
calculation golden tests; public auth and security tests.

Before declaring work complete, run the relevant subset and always run
`typecheck`, `lint`, `tests`, and the production `build`.

---

## Documentation

`docs/README.md` is the index. Update relevant documentation in the same change
as behaviour. Documentation describes implemented behaviour, not aspirations
presented as complete. Keep `CHANGELOG.md` `[Unreleased]` current.

---

## When Making a Change

1. Read this file and the relevant `docs/**/*.md`.
2. Confirm the change belongs to the correct tier and the active plan.
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
- Present future roadmap behaviour as already implemented.
