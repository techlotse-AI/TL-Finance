# Roadmap

## v0.1.0 - Budget

Implemented planned income routing, accounts and pockets, transfers, budget
items, monthly reconciliation, planned money-flow, locked later-tier surfaces,
household export/import, and baseline security.

## v0.2.0 - Analyze

Implemented. Production-ready structured statement import (UBS account, UBS card,
Revolut, and a generic CSV template) with fail-closed parsing and idempotent
commit; actual transactions and a review queue; deterministic allocation rules
with bulk application; internal-transfer and cross-currency FX matching with
high-confidence auto-confirmation; planned-versus-actual adherence; and
deterministic money-leak findings. Remaining institution parsers (Zuger
Kantonalbank, FNB, Standard Bank, Investec, Frankly/VIAC, Saxo) are added as
sanitized fixtures become available.

## v0.3.0 - Optimize

Started with an entitlement-protected, non-persistent deterministic scenario
comparison calculator. It uses explicit starting amounts, monthly contributions,
annual-return assumptions, and time horizons without changing Budget records.

Now also includes deterministic emergency-fund sizing (from Essential budget
items), Swiss Pillar 3a calculations (2026 limits, remaining headroom, tax
saving, and growth projection), and ranked, explainable recommendations that
combine the emergency-fund gap, Pillar 3a headroom, and Analyze findings.

Remaining v0.3.0 work: persisted scenario comparison and account-derived
balance forecasts built on committed Analyze actuals.

## v0.3.1 - Platform settings and portability

Started with authenticated multi-household user Budget backup portability,
instance-administrator user management, audit-log export, on-demand
S3-compatible platform snapshots, protected database reset, supported-currency
account setup, account-and-currency route UX, and free Frankfurter reporting
rate refreshes.

Automated platform restore, scheduled backups, and public-ready operational
validation remain v0.4.0 work.

## v0.4.0 - Public-ready security

Implemented public email verification and password reset delivery, shared
database-backed rate limiting, user session revocation, scheduled S3-compatible
backups, offline full-platform restore, v0.4 readiness checks, and public
operations/privacy/security runbooks. Every deployment still requires its own
restore rehearsal, container scan, and independent security approval before
public exposure.

## v0.5.0 - Versioned container releases

Implemented tag-driven Docker Hub publishing for `techlotse/tl-finance`.
Release tags must match the canonical package version. The release workflow
reports every High and Critical container vulnerability in a GitHub issue,
blocks publishing on Critical findings, and publishes matching `vX.Y.Z` and
`latest` tags only after verification succeeds.

## v0.7.0 - Optimize foundations

Implemented manual-first holdings/share tracking (lots, cost basis, unrealized gain, asset-class and currency allocation, base-currency conversion with missing-rate warnings), deterministic account balance forecasts from planned net flow with lowest-balance and shortfall detection, and persisted scenario comparisons re-computed from the stored definition. Optimize remains side-effect free: it never changes Budget. Structured holdings imports (Frankly/VIAC, Saxo) remain follow-up work.

## v0.7.5 - Retirement and pensions

Implemented Swiss pension planning. Capital pillars (2/3a/3b) project with an end-of-year annuity and aggregate to total capital at retirement. Pillar 1 (AHV) uses the official scale-44 two-segment Rentenformel with verified 2026 figures (min CHF 1,260, max CHF 2,520, full at 44 years and CHF 90,720 average income, 13th pension). It adds the requested calculation basis for late entry (contribution-gap scaling from a chosen entry age) and married couples (the combined pension capped at 150% of the maximum single pension, with proportional reduction when the cap binds). A retirement-readiness calculator combines AHV income, annuitized pension capital, and a sustainable investment drawdown into a coverage percentage, annual gap, and the level monthly saving required to close it. All calculations are deterministic, explainable, and covered by golden tests.

## v0.8.0 - Account-security hardening and Optimize launch

Implemented account-targeted login lockout with escalating, time-based backoff
layered on the existing IP rate limit, with enumeration-safe generic errors.
Added recovery paths: administrator unlock, password-reset clearing, and
automatic reset on successful sign-in, plus a security-event review surface and
admin lock status. This release also ships the v0.7.0 Optimize foundations and
v0.7.5 Swiss pension and retirement planning. TOTP two-factor authentication
remains planned follow-up work.

## v0.8.3 - Resilience (D1, D3, D4)

Implemented the first two Phase D items as self-contained, fully tested Optimize
calculators with no schema migration. D1 makes the emergency fund
income-protection-aware: a generic, country-agnostic model (monthly benefit,
waiting/elimination period, benefit duration, optional cap as a percent of
essential spend, and full-coverage months for notice/severance) reduces the
required liquid runway month by month, and a Swiss unemployment-insurance (ALV)
preset derives the benefit from the insured salary (70%, or 80% with dependent
children, age 55+, or a low salary; capped at CHF 12,350/month insured), paid
for up to 24 months (520 daily allowances) after a waiting period and once the
3-month statutory notice ends. The un-insured target remains the default
(absent protection = previous behaviour), and the reduction is fully explained.
D3 adds a debt payoff calculator: deterministic avalanche vs snowball schedules,
total interest, and payoff date from balances, rates, and minimum payments plus
an optional extra payment, with a pinned compounding convention (nominal APR
compounded monthly) and a guard for non-amortizing minimum payments. The generic
income-protection and debt inputs are designed to extend to other countries.
D4 adds a point-in-time net-worth statement: it aggregates account-derived cash
balances, holdings at market value, and pension balances as assets, minus debts
and any manual liabilities, into a reporting-currency total with per-line and
per-category reconciliation and missing-rate warnings. Strictly Optimize; never
surfaced in Budget; persists nothing. All three are deterministic, explainable,
and covered by golden tests. D2 (financial goals / sinking funds) remains the
last open Phase D item.

## v0.8.4 - Pension projections, budget editing, logout

Added optional provider-stated Pillar 2 (BVG) projection inputs: a vehicle can
carry the projected retirement capital and projected annual pension printed on
the member's statement, and when the capital is supplied it replaces the
computed projection (the contribution/growth split is still shown). This is the
"enter the predicted payout" path alongside the existing deterministic
prediction. Budget categories and budget items are now editable in place, and
both can be deleted when unused — categories are guarded server-side against
active references, budget items are soft-deleted. Added a logout control in the
app shell that revokes the current session via the audited signout endpoint.
Additive migration `20260624000000_v0_8_4_pension_projection_override`; pension
projection changes are golden-tested.

## v0.8.6 - Audit log filtering, transfer deletion, dependency refresh

The admin audit log gained database-backed filtering (action, resource type,
date range), a 10/20/50 page-size selector, and pagination, with the filter and
pagination logic unit-tested. Planned account transfers can be deleted from the
Transfers page. Refreshed dependencies (nodemailer 9, lucide-react 1.21,
@types/node 26, tailwindcss 4.3.1) and moved the Node runtime to 26.3.1-alpine.

## v0.8.7 - Spending accounts, pure-budget view, undici fix

Resolved HIGH CVE-2026-12151 by moving the Node runtime to 26.4.0-alpine
(patched bundled undici). Implemented Issue #30: accounts can be flagged as
shared "spending"/"daily" accounts, which the money-flow graph marks and groups
so they line up vertically; and a second "Pure budget" graph view excludes all
accounts/transfers, drawing income → category → item (category totals split by
income share). The graph transforms are unit-tested; additive migration only.

## v0.8.8 - Reverse money-flow (account minimums)

Added an "Account minimums" money-flow view that reverses the graph: it sums
funded budget items by paid-from account and by category, yielding each account's
minimum monthly requirement and each category's total (account → category →
item, no income/transfers), with a summary table. Unit-tested pure transform.

## v0.9.0 - Resilience & goals (Released — final pass before public Alpha)

Completed Phase D. Added financial goals / sinking funds (additive migration
`20260626120000_v0_9_0_financial_goals`, golden-tested `optimize/goals.ts`,
household-scoped `/api/optimize/goals` CRUD, and an Optimize **Goals** tab):
per-goal amount remaining, required monthly contribution to hit the target by
its date, progress, and on-track/ahead/behind/reached/unreachable/open-ended
status, aggregated in the household base currency. Added a deterministic budget
spend & savings analysis engine (`budget/analysis.ts` + `/api/budget/analysis`
+ `BudgetAnalysisPanel`): top spend categories, spend by group, essential vs
discretionary ratio, savings rate, 50/30/20 comparison, realistic savings
opportunities, a zero-based balance check, and plain-language insights, with
budget visualizations. Introduced whole-amount ("zero-cent") budgeting
(`money/rounding.ts`: round-to-nearest-5 + `formatWhole`) and a ±5
reconciliation tolerance, while stored money stays exact `Decimal(18,4)`.
Optimized the Docker image, added README badges, made the Trivy gate update a
single vuln issue in place, and added standard repo files (VERSION, LICENSE.md,
root CHANGELOG.md, CLAUDE.md). Full local gate verified green (typecheck, lint,
220 tests, next build); released as git tag `v0.9.0`.

## v0.9.3 - Budget workspace & Analyze hardening (Released)

Released 2026-07-16 (tag `v0.9.3`), bundling the forward plan's v0.9.1–v0.9.4
milestones under one tag. v0.9.1 stabilize/secure: the bundled-undici HIGH
(#33) auto-closed via the Trivy dedupe gate after the Node base-image bump;
vitest/coverage-v8 Dependabot grouping confirmed in place; the eslint 10 and
TypeScript 7 majors were verified locally as blocked by `eslint-config-next`'s
toolchain and parked with `@dependabot ignore`; STYLING.md seeded. v0.9.2
Budget UI: consistent empty/loading/error states, `formatWhole` (round-to-5)
on every Budget money display, a `BudgetSubNav` unifying the six Budget pages,
and a first-class `/categories` page extracted from Settings. v0.9.3 Budget
visualization/flow: money-flow graph zoom/pan/print/SVG-export, clickable
legend isolation, the accessible table moved into the graph component so it
tracks the active view/filters, analysis split into reusable cards with a
server-rendered dashboard summary, explicit ±5-tolerance wording, and an
entitlement-gated adherence cross-link. v0.9.4 Analyze hardening: previously
dead fixtures wired into golden tests, a fixture-driven FX-match test,
actionable "no parser recognized" errors listing every parser's rejection
reason, and review-queue split-allocation/pagination/bulk-actions. Also:
Optimize net-worth "comfort threshold" (0.01% of net worth, issue #53).

## v0.9.4 - South Africa: FNB import (Released)

Released 2026-07-16 (tag `v0.9.4`), carrying the forward plan's v0.9.5
milestone. Two FNB parsers built from real statements supplied by the owner
(sanitized fixtures committed, real files never persisted): the
production-ready `fnb-current-account` parser reads the emailed "Tax
Invoice/Statement" PDF (two real sanitized fixtures, running-balance
reconciliation golden tests) — PDF support added `unpdf` as the stack's first
documented locked-stack exception (AGENTS.md) since there is no
dependency-free way to read a PDF content stream; and the functional
`fnb-transaction-history` CSV parser (held at `productionReady: false` until
a second real sample arrives). Plus the `za` country profile with a South
African starter category preset, dependency-free OFX 1.x SGML / 2.x XML
reading infrastructure (unwired until an institution's dialect is validated
against a real export), ZAR flow confirmation tests, and an FNB dedupe-hash
idempotency test.

---

## Forward plan — v0.9.6 → v0.9.8 (road to 1.0.0-alpha.1)

Three product tracks ran through the v0.9.1–v0.9.5 series — **Budget (proper
UI in place)**, **Analyze (Revolut / UBS / FNB)**, and **Optimize (a full
future-planning and tracking suite)** — bookended by a stabilization/security
opener and a release-candidate hardening close. v0.9.1–v0.9.5 shipped (as
tags `v0.9.3` and `v0.9.4`, above); v0.9.6–v0.9.8 remain. Every step must
land the full gate green (`typecheck && lint && test && build`) and change
nothing in a lower tier.

### v0.9.1 - Stabilize & secure (foundation) — shipped in v0.9.3

Get every tier to a verified-green baseline before feature work. Resolve the
bundled-**undici** HIGH (CVE-2026-12151) by bumping the Node base image to a
patch that ships undici ≥ 6.27.0 and confirm the Trivy scan is clean (closes
#33). Land the held Dependabot work correctly: group `vitest` +
`@vitest/coverage-v8` so they bump together (unblocks #35/#39) and review/adopt
the eslint 10 major (#38) and actions/checkout 7 (#34). Fix CI branch-protection
ergonomics so the tag-only `publish` check doesn't leave PRs permanently
`BLOCKED`. Seed `STYLING.md` and shared design tokens for the Budget UI work.

### v0.9.2 - Budget UI, part 1 — structure & IA — shipped in v0.9.3

Consolidate income → accounts/pockets → transfers → categories → items into one
coherent, navigable Budget workspace with consistent empty/loading/error states.
Responsive layout and a keyboard/accessibility pass on the core budget forms.
Enforce whole-amount money display (`formatWhole`, round-to-5) everywhere.

### v0.9.3 - Budget UI, part 2 — visualization & flow — shipped in v0.9.3

Polish the money-flow graph (spending-accounts, pure-budget, and
account-minimums views) with legends, zoom, and print/export. Promote the
spend/savings analysis (50/30/20, savings opportunities, insights) to
first-class dashboard cards, and surface reconciliation/adherence inline with
clear ±5-tolerance messaging.

### v0.9.4 - Analyze — Revolut + UBS hardening — shipped in v0.9.3

Re-verify and harden the Revolut and UBS (account + card) statement parsers
against fresh sanitized fixtures; expand golden coverage for multi-currency,
refunds, fees, and FX matching. Polish the import review-queue UX and make
fail-closed parse errors actionable.

### v0.9.5 - Analyze — FNB (South Africa) — shipped in v0.9.4

Add an FNB statement parser (CSV/OFX) with sanitized fixtures, idempotent
commit, and ZAR handling, wired into the import picker. Lay ZA country-profile
groundwork (currency, date formats) and extend allocation rules and FX matching
to ZAR flows.

### v0.9.6 - Optimize — unified planning dashboard

Bring the existing engines (scenarios, income-protection emergency fund, Pillar
3a, pensions & retirement readiness, debt payoff, net-worth, goals) into a
single cohesive **Plan** dashboard with cross-links and a shared assumptions
panel. Persist point-in-time net-worth snapshots to draw a net-worth trend, and
surface goal-progress tracking alongside it. Optimize stays side-effect free.

### v0.9.7 - Optimize — future-planning expansion

Add the FX currency-exposure report, an inflation / real-terms toggle across
projections, and a tax-pack export. Add structured holdings imports
(Frankly/VIAC, Saxo). Optional what-if overlays combining goals, debt, and
retirement into a single projection.

### v0.9.8 - Release candidate → 1.0.0-alpha.1 gateway

End-to-end verification across Budget/Analyze/Optimize, a performance pass, and
`docs/` consolidation. Prepare the alpha rename in `MIGRATION.md` (relax
`version:check` for pre-release tags first). Ship the long-deferred **TOTP 2FA**
and login alerts as the security capstone, then cut `1.0.0-alpha.1`.
