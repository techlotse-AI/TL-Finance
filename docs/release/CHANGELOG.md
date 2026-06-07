# Changelog

## Unreleased

- Established the v0.1.0 repository, documentation, Docker, Next.js, Prisma,
  TypeScript, Tailwind, ESLint, and Vitest foundations.
- Added the initial planned Budget data model without balance or forecast
  fields.
- Added Decimal recurrence normalization, income-allocation reconciliation,
  planned money-flow reconciliation, graph warnings, and focused tests.
- Added revocable session authentication route foundations, trusted-origin
  checks, rate limiting, server-side capability primitives, and audit helpers.
- Added a dark operational route surface with a planned-flow graph, accessible
  flow table, and locked Analyze and Optimize pages.
- Added an additive initial migration, migration safety check, dependency
  security audit, and multi-stage production container.
- Completed persisted v0.1.0 Budget APIs and workflows, active household
  selection, member/tier administration, reporting FX, and JSON portability.
- Defined the future billing-provider boundary while keeping v0.1.0 tier
  assignment manual and payment-provider-free.
- Added production CSP and HSTS response headers to the v0.1.0 baseline
  security controls.
- Upgraded the application to the current supported Node, PostgreSQL 16, Next.js, React,
  Prisma, Tailwind, TypeScript, Zod, and supporting package releases. ESLint is
  pinned to the newest release supported by the current Next.js lint plugins.
- Hardened CI with immutable action SHAs, least-privilege permissions,
  deterministic runtime versions, concurrency control, and Dependabot.
- Corrected trusted-origin failures to return a production-safe `403` response.
- Removed the unused `SESSION_SECRET` setting; revocable sessions use
  cryptographically random opaque tokens and store only their hashes.
- Added PostgreSQL household-isolation, ownership, soft-delete, and audit tests.
- Started v0.2.0 with additive Analyze source-fact models, parser preview
  contracts, deterministic dedupe/allocation/transfer matching, and tests.
- Started v0.3.0 with an `optimize.run`-protected deterministic scenario
  comparison calculator, bounded Zod inputs, explicit projection assumptions,
  Decimal golden tests, and an entitled operational UI.
