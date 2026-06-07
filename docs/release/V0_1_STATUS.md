# v0.1.0 Implementation Status

The v0.1.0 Budget release scope is implemented. v0.2.0 Analyze foundation work
has started but no institution parser is production-ready.

## v0.1.0 implemented

- Docker-first Next.js/PostgreSQL/Prisma toolchain and additive initial schema
- Identity, revocable session, tenancy, role, entitlement, audit, and planned
  Budget database models
- Password hashing, trusted-origin checks, baseline auth rate limiting, safe API
  error responses, session token hashing, and mutation audit helpers
- Decimal recurrence normalization and income-allocation reconciliation
- Planned money-flow and reconciliation engine with explicit reporting currency
- Persisted household-scoped CRUD APIs and creation workflows for categories,
  accounts, pockets, income, transfers, and budget items
- Persisted monthly summary, graph, reconciliation warnings, filters,
  clickable nodes, and accessible flow table
- Centralized household reporting exchange rates with stale warnings
- Swiss and generic category preset definitions
- Locked Analyze and Optimize surfaces
- Active household selection, members, manual instance-admin tier assignment,
  a future billing-provider boundary, and validated household JSON export/import
- PostgreSQL household isolation, ownership, soft-delete, and audit integration
  tests
- Documentation, migration safety, dependency audit, CI, and production image

## v0.2.0 started

- Additive Analyze source-fact, allocation-rule, and transfer-match schema
- Fail-closed parser registry and statement preview contract
- Deterministic content/row dedupe hashes
- Signed split-allocation reconciliation
- Household-safe deterministic same-currency transfer candidate scoring
- Protected Analyze status and preview endpoints

## Required before v0.2.0 release

- Add at least two sanitized real fixtures and production parsers for each
  supported institution format
- Implement preview UI and idempotent transaction commit
- Implement allocation/review queue, rules, cash, transfer/FX confirmation,
  adherence, actual graphs, trends, and deterministic findings
