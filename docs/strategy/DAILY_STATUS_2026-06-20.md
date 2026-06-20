# Daily Status & Improvement Suggestions — 2026-06-20

_Automated daily status run. Read-only assessment; no code was changed._

## 1. Health snapshot

| Check | Result |
| --- | --- |
| Version | v0.8.1 (`package.json`), working tree clean on `main` |
| `tsc --noEmit` | Pass (no errors) |
| `vitest run` | 128 passed, 5 skipped, 0 failed (38 test files) |
| `eslint .` | Not conclusive — run exceeded the sandbox time limit; rerun locally to confirm |

The codebase is in a releasable, green state. Last substantive work (v0.7.0 → v0.8.1)
landed 2026-06-17: Optimize foundations, Swiss pensions/retirement, and account-security
hardening.

## 2. Where the roadmap stands

Phases A, B and C of `docs/strategy/IMPROVEMENT_ROADMAP.md` are shipped (v0.6 → v0.8):
account-security lockout + recovery, holdings/valuation, balance forecasts, persisted
scenarios, multi-pillar pensions and retirement readiness.

**Phase D (v0.9.0 — "Resilience & goals") is the next unbuilt phase** and nothing in it
exists yet (verified: no `debt.ts`, no `FinancialGoal`, no net-worth code in `src/`):

- **D1** Income-protection-aware emergency fund
- **D2** Financial goals / sinking funds
- **D3** Debt payoff calculator
- **D4** Net-worth statement

Also open: backlog items (FX exposure report, inflation/real-terms toggle, tax-pack export,
login alerts, passkeys, ZA country profile) and the deferred **TOTP 2FA** from Phase A.

## 3. Recommended for today (ranked by self-containedness)

The project rule is "self-contained and fully tested." These are ordered so the top pick
can ship in a single day with golden tests and **no schema migration**.

### Top pick — D3: Debt payoff calculator (`src/lib/optimize/debt.ts`)
Pure deterministic computation, no persistence or migration, no dependency on other Phase D
items. Avalanche vs snowball schedules, total interest, payoff date from
balances/rates/minimum payments. Optimize-tier only (Budget forbids debt math). Fits the
"explainable + golden test" pattern already used by `recommendations.ts` and `ahv.ts`.
Lowest risk, highest completion certainty for one day.

### Strong alternative — D1: Income-protection-aware emergency fund
Additive change to the existing `computeEmergencyFund` in `src/lib/optimize/emergency-fund.ts`.
New inputs are optional, so absent ⇒ today's exact output (regression guard). Deterministic,
no migration. Slightly more care needed because it touches a shipped function and its
recommendation wiring.

### If appetite is larger — FX exposure report (backlog)
Aggregates currency exposure across existing pockets + holdings (both already modelled). A
read-only reporting calc, Optimize-tier, deterministic. No migration; some integration work
to join the two sources.

Items deliberately **not** recommended for a single day: D2 (needs a `FinancialGoal` model +
migration + API + UI) and D4 (depends on D3 and on holdings/pension aggregation). TOTP 2FA is
valuable but touches the auth-critical path and warrants a dedicated, carefully reviewed day.

## 4. Suggested approach if implementing D3

1. New lib `src/lib/optimize/debt.ts`, pure functions returning `basis[]`-style explanations.
2. Golden tests `debt.test.ts` covering: single debt; avalanche vs snowball ordering;
   interest accrual; extra-payment rollover; zero-interest; min-payment-below-interest guard.
3. Server-side `OPTIMIZE` entitlement enforcement on any new route; household-scoped.
4. Money as strings on the wire, decimal.js in code — match existing money discipline.
5. Update `CHANGELOG.md` (Unreleased) and the roadmap when done.

Accuracy note: amortization is sensitive to interest-compounding convention (monthly nominal
vs effective). Pin one convention explicitly in the lib doc-comment and assert it in tests so
advice is unambiguous, per the project's accuracy mandate.
