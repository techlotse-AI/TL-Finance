# Architecture

TL Finance is one Next.js application backed by one PostgreSQL database. The
App Router owns pages and route handlers. Shared server libraries own
authentication, authorization, audit, money arithmetic, and Budget behavior.

## Boundaries

- Budget owns planned income, account pockets, transfers, categories, items,
  monthly normalization, and planned money-flow.
- Analyze foundation owns immutable imported source facts, parser contracts,
  deterministic dedupe, allocations, and transfer matching. Full Analyze
  workflows are not yet implemented.
- Optimize owns deterministic scenario projections. The first v0.3.0 slice is
  an on-demand, non-persistent calculator protected by `optimize.run`.
  Account-derived forecasts remain blocked on completed Analyze data.
- `Household` is the mandatory tenant boundary for every financial row.
- Decimal values are persisted as PostgreSQL decimal values and serialized as
  strings at API and component boundaries.
- Manual administrator assignment is the only implemented entitlement source.
  `BillingProvider` defines the boundary for a future payment integration, but
  v0.1.0 does not ship a provider implementation or webhook route.

## Request path

Every household-owned request must authenticate a database session, resolve the
active household, verify membership and capability, validate input with Zod,
scope database work by `householdId`, verify foreign-key ownership, and append
an audit event for mutations.

Budget APIs use this request path and build persisted monthly reports from the
active household. Analyze APIs additionally enforce `analysis.*` capability
checks. Optimize calculation APIs enforce `optimize.run`, validate bounded
assumptions, and return Decimal values as strings.
