# Changelog

All notable changes to TL-Finance are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The detailed historical log for v0.1–v0.8 lives in
[`docs/release/CHANGELOG.md`](docs/release/CHANGELOG.md).

## [Unreleased]

### Added

- **Analyze — FNB Private Clients Current Account statement parser (v0.9.5).**
  Reads FNB's real emailed "Tax Invoice/Statement" PDF format, ZAR only. Adds
  `unpdf` as a documented exception to the locked, otherwise dependency-free
  statement-ingestion stack (see AGENTS.md Stack) — every other parser reads
  plain text; there is no dependency-free way to read a PDF's content stream.
  The PDF-extraction step (`pdf.ts`) is a thin wrapper; all real parsing logic
  is a pure, fixture-tested function (`parseFnbCurrentAccountText`) operating
  on already-extracted text, same architecture as the OFX reader. Verified
  against two real statements one month apart (sanitized for the committed
  fixtures — name/address/account number fabricated, transaction shape and
  amounts real): every row's running balance reconciles exactly against the
  printed Opening/Closing Balance and the "Turnover for Statement Period"
  credit/debit counts, satisfying AGENTS.md's two-real-fixture rule. Handles
  format quirks confirmed from the real files: dates are "DD Mon" with the
  year resolved from the printed statement period (not guessed), amounts are
  a bare number for a debit vs. a "Cr" suffix for a credit (never a minus
  sign), and the trailing monthly-fee row's description is dropped by PDF
  text extraction in both real files (a "#"-glyph encoding quirk) and is
  filled in as "Monthly Account Fee" rather than left blank.
- **Analyze — Revolut + UBS hardening (v0.9.4).** Expanded golden coverage
  onto two fixtures that existed but were never exercised by tests:
  `revolut-2.csv` (a EUR wallet with an exchange credit, a transfer, and a
  positive refund — real multi-currency and refund coverage) and
  `ubs-card-2.csv` (a "Payment received" credit row). Added a fixture-driven
  FX-match golden test: real parser output for a Revolut CHF exchange debit
  and its matching EUR exchange credit (added to `revolut-2.csv`, mirroring
  how Revolut's actual export produces a same-day `EXCHANGE` row on both
  currency wallets) is run through `findTransferCandidates`, not synthetic
  in-memory rows. The `unsupported_statement` error is now actionable: a new
  `detectStatementParserAttempts`/`UnsupportedStatementError` carries every
  registered parser's confidence and rejection reason, surfaced as "Tried:
  ubs-account (UBS): not semicolon-delimited; …" instead of a generic
  message, and distinguishes an ambiguous tie from no match at all.
  Review-queue UX: transactions can now be split across multiple categories
  (the backend already supported it; the UI never exposed it), the list is
  paginated (25/page with a total count) instead of a hardcoded 100-row cap,
  bulk select/allocate/ignore works across a page, and the import preview's
  warning list can be expanded past 25 or exported as CSV.
- **Budget — money-flow graph visualization & flow polish (v0.9.3).** The
  money-flow graph gained zoom (buttons, drag-to-pan, and keyboard +/-/arrow
  controls, clamped 100%-300%), print (`print:hidden` chrome so only the
  legend and graph show), and SVG export (always exports the full untouched
  graph regardless of current zoom/pan). Legend entries are now clickable to
  isolate a route (dims the rest). The accessible tabular alternative for the
  full/pure-budget views moved from a static, always-full-data table on the
  dashboard into the graph component itself, so it now always matches the
  active view mode and filters instead of ignoring them. Reconciliation and
  allocation messaging states the ±5 tolerance explicitly instead of implying
  it. The spend/savings analysis panel was split into reusable cards
  (`SpendByCategoryCard`, `GuidelineCard`, `SavingsOpportunitiesCard`,
  `InsightsCard`) shared between the full `/budget` panel and a new
  server-rendered `BudgetInsightsSummaryCard` (savings rate, essential ratio,
  top insight) on the Monthly-plan dashboard — no extra client round-trip; a
  new `loadBudgetAnalysis` loader is shared by both the dashboard and the
  `/api/budget/analysis` route. An entitlement-gated `AdherenceCrossLinkCard`
  points Budget users at Analyze's planned-vs-actual adherence without
  duplicating that computation (adherence stays an Analyze-owned concept).
- **Budget — coherent, navigable workspace and a first-class Categories page
  (v0.9.2, part 2).** New `BudgetSubNav` cross-links the six Budget-tier
  pages (Monthly plan, Income, Accounts, Transfers, Categories, Budget
  items), rendered on every one of them so they read as one workspace
  instead of disconnected sidebar routes. Category management (previously
  only reachable from Settings, alongside unrelated household/backup/member
  concerns) moved to its own `/categories` page, completing the roadmap's
  stated income → accounts → transfers → categories → items sequence;
  Settings links to the new location for anyone who bookmarked the old spot.
  No data model changes — same `/api/categories` endpoints, same
  `CategoryCreateForm`/`CategoryActions` components, just relocated into the
  Budget IA.
- **Optimize — Net worth comfort threshold.** `computeNetWorth` reports
  `comfortThreshold`: 0.01% of net worth (floored at zero when net worth is
  negative), the point below which a price difference is financially
  negligible against total wealth and not worth spending mental energy
  comparing. Surfaced as a new metric on the Optimize Net worth panel via
  `formatWhole`.
- **Budget — consistent empty/loading/error states and whole-amount display
  (v0.9.2, part 1).** New `EmptyState` primitive wired into `DataTable`, so
  the income/accounts/transfers/budget-item lists show helpful copy instead
  of a blank table at zero rows. Route-level `loading.tsx` skeletons and a
  shared `error.tsx` boundary (with a "Try again" action) now exist for the
  Budget dashboard and the four Budget-tier pages. Every Budget-tier money
  display (dashboard, income, transfers, budget items, the budget analysis
  panel) now uses `formatWhole` (round-to-nearest-5) instead of 2-decimal or
  ad hoc formatting, matching the "zero-cent" budgeting rule. Fixed
  `TransferCreateForm`, the one create form missing `<label>` elements
  (relied on placeholder text only).
- **Budget — Provisions and per-account in/out totals in the money-flow graph.**
  A non-monthly expense (quarterly/yearly/selected-months) is now treated as a
  provision — an annual bill saved monthly — and its flows render with a short
  dash distinct from the transfer dash. Account nodes show an "in X · out Y"
  line, a tooltip stating whether the account is fully allocated (within the
  ±5 tolerance) or has an unallocated remainder, and an amber dot when a
  remainder exists.
  `MoneyFlowResult` gains `accountTotals` plus totals splits
  (`expenseProvisions`, `savings`, `investments`, `retirement`). The budget
  analysis reports `provisionsMonthly` and the saving/investing/retirement
  split, surfaced as new cards on the Budget page.
- **Optimize — Wealth planner engines (module groundwork).** Two new pure,
  golden-tested engines: `src/lib/optimize/wealth-projection.ts` (compound
  growth in real terms with a contribution schedule — base monthly, absolute
  step changes, annual lump sums, start-of-month one-time injections — yearly
  pay-ins/growth split, lever-vs-baseline comparison, and a
  growth-covers-contribution marker) and `src/lib/optimize/drawdown.ts`
  (retirement drawdown: fixed-horizon annuity draw, endowment draw `V·i`,
  fixed-expense depletion age with a truthful `sustainable` flag, and yearly
  balance curves). Shared `WealthPlan` config schema (`wealthPlanConfigSchema`,
  version 1) documented in `src/lib/optimize/schemas.ts`.
- **Optimize — Wealth planner persistence + API.** New `WealthPlan` model
  (additive migration `20260711000000_v0_9_1_wealth_plans`; household-scoped,
  soft-deleted, audited, `config` Json validated against
  `wealthPlanConfigSchema` v1) and routes: `POST /api/optimize/wealth/projection`
  and `POST /api/optimize/wealth/drawdown` (stateless calculations), plus
  `GET/POST /api/optimize/wealth/plans` and `PUT/DELETE
  /api/optimize/wealth/plans/{id}` for saved plan configurations.
- **Optimize — Wealth planner tab (first Recharts consumer).** New "Wealth
  planner" tab: one shared plan configuration drives the wealth-over-time
  chart (ordinal per-rate blue ramp), the pay-ins vs internal-growth stacked
  areas with the growth-covers-contribution marker, the lever comparison with
  deltas at the horizon, and the drawdown value curves plus the monthly-draw
  rate × horizon table. Chart series colors are new `--chart-*` tokens,
  validated for lightness band, chroma, CVD separation, and surface contrast
  against the card surface; every chart ships a stacked legend block (no
  overlapping end labels), an empty state, and a tabular alternative.

### Changed

- Dependency refresh (Dependabot, CI-green): lucide-react 1.21.0 → 1.22.0,
  recharts 3.8.1 → 3.9.0, postcss 8.5.15 → 8.5.16.

### Removed

- Deleted an orphaned duplicate of `TL-Project.MD` that had been committed under
  a FUSE placeholder filename (`.fuse_hidden…`).

## [0.9.0] - 2026-06-26 — "Resilience & goals" (final pass before public Alpha)

### Added

- **Optimize — Financial goals / sinking funds (Phase D, D2).** New
  `FinancialGoal` model (additive migration `20260626120000_v0_9_0_financial_goals`)
  and a deterministic, golden-tested engine (`src/lib/optimize/goals.ts`) that
  computes, per goal: amount remaining, the monthly contribution required to
  reach the target by the target date, progress, and an on-track / ahead /
  behind / reached / unreachable / open-ended status against the saver's planned
  contribution. Aggregates targets, saved and required-monthly across goals in
  the household base currency (excludes currencies with no reporting rate).
  CRUD API at `/api/optimize/goals` (+ `/[id]`), household-scoped, audited,
  soft-deleted.
- **Budget — Spend & savings analysis.** New deterministic, golden-tested engine
  (`src/lib/budget/analysis.ts`) and `/api/budget/analysis` route: top spend
  categories, spend by group, essential vs discretionary ratio, savings rate, a
  50/30/20 needs/wants/savings comparison, realistic savings opportunities (a 15%
  trim on discretionary categories above 5% of income), a zero-based balance
  check, and plain-language insights.
- **Budget — Visualizations.** Added charts to make the budget easier to read at
  a glance (category breakdown, essential vs discretionary, 50/30/20, and goal
  progress).
- **Whole-amount budgeting.** `src/lib/money/rounding.ts`: round-to-nearest-5
  helpers and a `formatWhole` zero-cent currency formatter, applied across
  analysis and display. Stored money stays exact `Decimal(18,4)`.
- Standard repository files: top-level `VERSION`, `LICENSE.md`
  (Techlotse Source-Available), root `CHANGELOG.md`, and a `CLAUDE.md` pointer to
  `AGENTS.md`.
- README badges: release version, CI build status, and the Trivy security gate.

### Changed

- **Reconciliation tolerance.** Money-flow reconciliation and adherence now treat
  a residual within ±5 whole units as rounding noise rather than a discrepancy —
  the budget balances to zero at the dollar, not the cent, level
  (`RECONCILIATION_TOLERANCE`).
- **Docker image** optimized for size and build performance (smaller runner
  layers, production-only dependencies, cache-friendly layer ordering).
- **CI Trivy security gate** now updates a single open vulnerability issue in
  place (and closes it when a scan is clean) instead of opening a new issue on
  every run.
- `version:check` now also asserts the top-level `VERSION` file matches
  `package.json`.

### Notes

- This is the final pass before the public Alpha. The `MIGRATION.md` rename to the
  `1.0.0-alpha.1` alpha release channel remains a deliberate follow-up step.
