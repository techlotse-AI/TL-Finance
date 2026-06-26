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
