# Architecture

TL Finance is one Next.js application backed by one PostgreSQL database. The
App Router owns pages and route handlers. Shared server libraries own
authentication, authorization, audit, money arithmetic, and Budget behavior.

## Boundaries

- Budget owns planned income, account pockets, transfers, categories, items,
  monthly normalization, and planned money-flow.
- Normal account workflows expose accounts and supported currencies. The
  currency-specific `AccountPocket` remains the internal planned-flow node and
  is not removed from the domain model.
- Analyze owns immutable imported source facts, fixture-backed parsers,
  deterministic dedupe, allocations, transfer/FX matching, adherence, and
  explainable findings.
- Optimize owns deterministic scenario projections, emergency-fund sizing,
  Swiss Pillar 3a calculations, and ranked explainable recommendations.
- `Household` is the mandatory tenant boundary for every financial row.
- Decimal values are persisted as PostgreSQL decimal values and serialized as
  strings at API and component boundaries.
- Manual administrator assignment is the only implemented entitlement source.
  `BillingProvider` defines the boundary for a future payment integration, but
  v0.1.0 does not ship a provider implementation or webhook route.
- Platform operations own instance-level user state, audit export, protected
  reset, scheduled S3-compatible snapshots, and offline full-platform restore.
  User backups remain
  separate, validated, portable exports of live Budget household data.

## Request path

Every household-owned request must authenticate a database session, resolve the
active household, verify membership and capability, validate input with Zod,
scope database work by `householdId`, verify foreign-key ownership, and append
an audit event for mutations.

Budget APIs use this request path and build persisted monthly reports from the
active household. Analyze APIs additionally enforce `analysis.*` capability
checks. Optimize calculation APIs enforce `optimize.run`, validate bounded
assumptions, and return Decimal values as strings.

Public authentication uses hashed one-time verification and password-reset
tokens. Password reset revokes every active session. Authentication throttling
uses PostgreSQL-backed `RateLimitBucket` rows so limits remain effective across
multiple application instances.
