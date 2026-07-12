# Changelog

All notable changes to TL-Finance are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The detailed historical log for v0.1–v0.8 lives in
[`docs/release/CHANGELOG.md`](docs/release/CHANGELOG.md).

## [Unreleased]

### Added

- **Budget — Provisions and per-account in/out totals in the money-flow graph.**
  A non-monthly expense (quarterly/yearly/selected-months) is now treated as a
  provision — an annual bill saved monthly — and its flows render with a short
  dash distinct from the transfer dash. Account nodes show an "in X · out Y"
  line, a tooltip stating "in equals out" (within the ±5 tolerance) or the
  unallocated remainder, and an amber dot when a remainder exists.
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
>>>>>>> origin/main

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
