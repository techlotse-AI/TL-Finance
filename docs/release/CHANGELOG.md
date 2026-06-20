# Changelog

## Unreleased

- Optimize v0.9.0 (D1): the emergency fund is now income-protection-aware. A
  generic, country-agnostic model reduces the required reserve for the months a
  benefit covers essential spending (monthly benefit, waiting/elimination
  period, optional benefit duration, optional cap as a percent of essential, and
  full-coverage months for notice/severance). Added a Swiss unemployment (ALV)
  preset deriving a 70%/80% benefit on the insured salary (capped at CHF
  12,350/month) for up to 24 months after a waiting period and the statutory
  notice. Absent protection reproduces the previous target exactly; the
  reduction is explained and surfaced in the Advisor. New `swissUnemployment` /
  `incomeProtection` inputs on `/api/optimize/emergency-fund` and
  `/api/optimize/recommendations`.
- Optimize v0.9.0 (D3): added a debt payoff calculator (`/api/optimize/debt`)
  with deterministic avalanche vs snowball schedules, total interest, payoff
  date, and the avalanche/snowball trade-off. Compounding is pinned to nominal
  APR compounded monthly; non-amortizing minimum payments are flagged. A new
  Debt tab in the Optimize workspace compares both strategies. Optimize-only;
  debt math never appears in Budget. No schema migration; golden-tested.

## v0.8.1 - 2026-06-17

- Named each Compose service container (TL-Finance-App, TL-Finance-Db, TL-Finance-Migrate, TL-Finance-Backup-Scheduler) for clearer container listings. Cosmetic only.
- Aligned package-lock to the package version and set the npm audit gate to --audit-level=critical (unfixable hono transitive advisory, not shipped at runtime).

## v0.8.0 - 2026-06-17

- Added account-targeted login lockout layered on the IP rate limit: after a
  configurable number of consecutive failed sign-ins (default 5) the account
  locks for an escalating, time-based backoff (default 15/30/60/120 minutes).
  Locked accounts return the same generic error as a wrong password to prevent
  account enumeration.
- Added account recovery: an instance administrator can unlock an account via
  `/api/admin/users/unlock` (audited), a completed password reset clears the
  lock, and every successful sign-in resets the failure counter.
- Added a security-event review surface (`/api/admin/security-events`) and an
  admin unlock control with locked-account status in user management.
- Added the additive migration `20260617000000_v0_8_login_lockout` for the
  `User` lockout columns, and `LOGIN_LOCKOUT_THRESHOLD` /
  `LOGIN_LOCKOUT_BACKOFF_MINUTES` configuration.
- Shipped the Optimize v0.7.0 foundations (holdings, balance forecasts,
  persisted scenarios) and v0.7.5 Swiss pension and retirement planning as part
  of the v0.8.0 release.

- Optimize v0.7.0: added manual holdings/share tracking with cost basis, unrealized gain, and asset-class/currency allocation converted to the base currency; deterministic account balance forecasts from planned net flow with shortfall detection; and persisted, re-runnable scenario comparisons. All are entitlement-gated, household-scoped, and audited; holdings, pensions, and scenarios never feed the Budget money-flow.
- Optimize v0.7.5: added Swiss pension planning. Capital-pillar (2/3a/3b) projection and aggregation; a Pillar 1 (AHV) pension using the scale-44 two-segment Rentenformel with late-entry contribution-gap scaling and the married-couple 150% cap (2026 figures, incl. the 13th pension); and a retirement-readiness calculator combining AHV income, annuitized pension capital, and a sustainable investment drawdown into a coverage gap and the monthly saving required to close it.
- Added the additive migration `20260616000000_v0_7_optimize_holdings_pensions` for Holding, HoldingLot, PensionVehicle, and ScenarioComparison.

- Made the primary Compose definition cloud-ready: it pulls matching,
  version-pinned application and migrator images from Docker Hub, runs
  migrations before application rollout, keeps PostgreSQL private, requires
  deployment secrets, and defaults the application bind address to loopback
  for a host TLS ingress.
- Added a local-development Compose override and environment template so source
  builds remain explicit and separate from cloud deployment.
- Extended release publishing and vulnerability scanning to the dedicated
  `techlotse/tl-finance-migrator` image, and added cloud/local Compose
  validation to CI.
- Updated Nodemailer to 8.0.11 after its prior release became subject to
  Moderate-severity header-injection, transport-access, and OAuth2 TLS
  advisories.

## v0.5.0 - 2026-06-14

- Added tag-driven Docker Hub releases for `techlotse/tl-finance`. A matching
  semantic version tag publishes both the versioned tag and `latest`
  only after the full verification job and container scan pass.
- Added complete High/Critical container-vulnerability issue reporting and a
  Critical-severity publish gate.
- Pinned the transitive esbuild toolchain to a patched release so the v0.5.0
  dependency audit remains clean.
- Upgraded Alpine runtime packages during image builds so the v0.5.0
  release candidate does not ship known High OpenSSL vulnerabilities.
- Made `package.json` the canonical application version, enforced lockfile and
  release-tag consistency, and exposed the canonical version through the
  health endpoint.
- Exposed budget-item recurrence controls for one-time, weekly, monthly,
  quarterly, yearly, and selected-month expenses. The form now explains the
  amount expected for each recurrence, and the table shows both entered and
  normalized monthly amounts.
- Added semantic money-flow presentation: crossing-first receiving-account
  lanes for income, largest-first outflow ordering, visible node values and
  stage labels, deterministic per-source/category colors, dashed transfers, a
  route legend, and connected path-aware filters.
  Removed the inactive month selector that implied unsupported month-specific
  graph data.
- Reworked the planned money-flow graph with value-aware node sizing, stacked
  route attachment points, crossing reduction, and forward-only visual stages
  for internal transfers and contribution destinations.
- Added account edit and flow-safe delete controls. Account metadata edits keep
  stable flow IDs; deletion is blocked while active Budget routes reference an
  account and preserves linked Analyze history through soft deletion.
- Added optional masked IBAN/account references to Budget accounts and
  household-scoped Analyze statement-account suggestions. Full account
  identifiers are discarded before persistence and ambiguous matches never
  auto-select an account.
- Fixed instance-administrator bootstrap: local/private instances now promote
  the first registered user when `INSTANCE_ADMIN_EMAIL` is blank, while public
  deployments can reserve bootstrap access for an explicitly configured email.
  Removed the hard-coded `admin@example.com` Compose value and made first-user
  assignment concurrency-safe.
- Completed the v0.4.0 code and documentation surface: SMTP-backed email
  verification and password reset, hashed one-time tokens, shared PostgreSQL
  auth throttling, user session revocation, scheduled platform backups, offline
  destructive restore, readiness checks, and public security/operations
  runbooks.
- Extended the v0.3.0 Optimize tier with deterministic, store-nothing tools:
  emergency-fund sizing from Essential budget items, Swiss Pillar 3a planning
  (2026 limits, remaining headroom, marginal-rate tax saving, and growth
  projection), and ranked, explainable recommendations that combine the
  emergency-fund gap, Pillar 3a headroom, and Analyze findings.
- Added an end-to-end import-stack test that chains parsing, commit records,
  rule allocation, transfer matching, adherence, and findings.
- Completed the v0.2.0 Analyze tier: production-ready statement parsers
  (UBS account CSV, UBS card CSV, Revolut CSV, and a generic CSV template),
  each fixture-backed with golden tests and fail-closed on ambiguous dates,
  signs, currency, or amounts.
- Added an idempotent statement commit flow with content-hash and per-row
  dedupe, batched writes, and import status counts.
- Added the review queue, manual and split allocation, and deterministic
  allocation rules (merchant/description/counterparty/reference;
  exact/contains/prefix/regex) with bulk application. Unknown actuals never
  auto-assign to a category.
- Added internal-transfer and cross-currency FX matching with greedy
  one-to-one assignment, high-confidence auto-confirmation, and manual
  confirm/reject. Confirmed transfers are excluded from spending.
- Added planned-versus-actual adherence per category and currency, and
  deterministic money-leak findings (over-budget, duplicate charges,
  recurring and rising subscriptions, review backlog).
- Replaced the locked Analyze surface with an operational import, review,
  transfers, adherence, and findings workspace.
- Merged all local branch work into `main` and recorded the v0.3.0/v0.4.0
  release-readiness test results.
- Preserved append-only audit history during platform database reset.
- Added missing trusted-origin enforcement to platform backup and
  exchange-rate refresh.
- Added a CI guard that rejects unsafe API methods without explicit
  trusted-origin enforcement.
- Started v0.3.1 platform operations with instance-administrator user
  management, audit-log CSV export, environment-configured S3-compatible
  platform backups, and a password-plus-confirmation protected database reset.
- Added authenticated user backup export/import for every accessible
  household's current live Budget plan and reporting exchange rates.
- Added account creation with supported currencies, while retaining
  currency-specific account pockets as internal flow nodes.
- Made income and budget-item currency routes display account names and
  currencies, filter dependent options, and reject mismatched currencies
  server-side.
- Added free, no-key Frankfurter institutional reference-rate refreshes for
  reporting exchange rates.
- Documented that Essential marks required spending for adherence and future
  emergency-fund calculations without changing budget totals.
- Replaced the non-administrator Admin page exception with an explicit
  access-denied state.
- Labeled the income receiving-pocket selector, added explicit empty-state
  guidance, included account and currency details in its options, and defaulted
  new income currency to the active household base currency.
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
