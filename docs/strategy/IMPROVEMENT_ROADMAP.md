# Improvement Roadmap & Instruction Set (Proposal)

Status: **proposal / conceptual** — nothing in this document is built yet. It
extends the shipped baseline at `docs/strategy/ROADMAP.md` (current checkout
v0.5.0). Every item here must respect the locked product boundaries, money
rules, tenancy model, additive-migration policy, soft-delete, and audit
requirements in `AGENTS.md`. Build order and scope are subject to review before
any code is written.

---

## 1. Current state (verified)

| Area | Shipped today | Gap this roadmap closes |
| --- | --- | --- |
| **Tiers** | Budget + Analyze complete; Optimize deterministic tools complete | Optimize lacks holdings, multi-pillar pensions, retirement readiness, persisted scenarios, balance forecasts |
| **Auth** | DB-backed revocable sessions, password hashing, email verification, password reset, session revocation | No per-account lockout, no failed-attempt tracking, no admin unlock, no 2FA |
| **Rate limiting** | `RateLimitBucket` IP/volume limit on signin (10 / 15 min) | Volume limit only — does not protect a single targeted account or lock it |
| **Optimize libs** | `emergency-fund.ts`, `pillar3a.ts`, `projection.ts`, `recommendations.ts` — deterministic, explainable, non-persistent | Emergency fund ignores insurance/income protection; pensions limited to Pillar 3a; no holdings/net-worth |
| **Data model** | `Account`/`AccountPocket` (no balances by design), `INVESTMENT`/`RETIREMENT` account+category kinds exist but unused for holdings | No `Holding`, `PensionVehicle`, `FinancialGoal`, valuation, or lockout fields |
| **Admin** | Instance-admin user management (activate/deactivate, session revoke), audit export, backups, tier assignment, DB reset | No account-unlock action, no security-event review surface |

Stack is fixed: Next.js App Router, TypeScript strict, Prisma/PostgreSQL 16,
Zod, decimal.js, Recharts, Vitest. Money is `Decimal(18,4)` in DB, decimal.js in
code, strings on the wire. Optimize must never mutate Budget and must not send
raw transaction data to external AI by default.

---

## 2. Guiding constraints (apply to every feature below)

1. **Additive migrations only.** New columns nullable or defaulted; never edit a
   released migration.
2. **Deterministic and explainable.** Every Optimize output cites its inputs
   (`basis[]`), exactly as `recommendations.ts` already does. Golden tests
   required for each calculation.
3. **Tenancy.** Every new household-owned row carries `householdId`; every read
   and write is household-scoped and role-checked. Holdings/pensions/goals are
   Optimize-tier — enforce the `OPTIMIZE` entitlement server-side.
4. **Money discipline.** Native currency stored per row; convert only at
   reporting boundaries via the existing `ExchangeRate` cache with stale
   warnings; values cross the wire as strings.
5. **Audit + soft delete.** Every state change writes an append-only audit
   event with hashed IP; financial records soft-delete (`active=false`,
   `deletedAt`).
6. **Boundary respect.** Net worth, balances, forecasts, holdings, debt-payoff,
   and predictions live in **Optimize only** — never in Budget.

---

## 3. Phased roadmap

| Phase | Version | Theme | Headline features |
| --- | --- | --- | --- |
| A | v0.6.0 | Account-security hardening | Failed-login lockout + admin recovery; security-event surface; (optional) TOTP 2FA |
| B | v0.7.0 | Optimize foundations | Holdings/share tracking + valuation; account-derived balance forecasts; persisted scenarios |
| C | v0.8.0 | Retirement & pensions | Multi-pillar pension vehicles; pension predictions; retirement-readiness calculator |
| D | v0.9.0 | Resilience & goals | Income-protection-aware emergency fund; financial goals; debt payoff; net-worth statement |
| — | backlog | Cross-cutting | FX exposure report, inflation-real toggle, tax pack export, login alerts, passkeys |

Phases are independently shippable. A precedes nothing (security can ship
first). C depends on B's valuation primitives; D depends on B/C for net worth.

---

## 4. Phase A — Account-security hardening (v0.6.0)

### A1. Failed-login lockout with admin recovery *(explicit request)*

**Concept.** The current IP rate-limit throttles request volume but does not
protect a single account that is being targeted, nor does it lock it. Add an
account-targeted lockout layered *on top of* the IP limit: count consecutive
failed password attempts per user, lock the account after a threshold with
escalating backoff, auto-reset on success or successful password reset, and give
instance admins a one-click unlock.

**Schema delta (`User`).**

```prisma
failedLoginCount   Int       @default(0)
lockedUntil        DateTime?
lastFailedLoginAt  DateTime?
```

No new model needed; `RateLimitBucket` stays as the IP/volume layer.

**Policy (defaults, make env-configurable).**

| Parameter | Default | Notes |
| --- | --- | --- |
| Threshold | 5 consecutive failures | Counts only failures against an existing active user |
| Lockout duration | 15 min, then escalate (15 → 30 → 60 → 120, cap) | Backoff keyed off `failedLoginCount` tiers |
| Reset | On successful signin or completed password reset | Clears count + `lockedUntil` |
| Hard lock | Optional: after N escalations require admin/reset unlock | Configurable, default off |

**Signin route changes (`src/app/api/auth/signin/route.ts`).**

1. Keep IP rate-limit first.
2. Load user; if `lockedUntil > now`, reject **with the same generic
   `invalid_credentials` message** (avoid account enumeration) but emit an
   `auth.signin.locked` audit event and skip the password check.
3. On bad password for an existing active user: increment `failedLoginCount`,
   set `lastFailedLoginAt`; if threshold reached set `lockedUntil` and emit
   `auth.account.locked`.
4. On success: reset counters, then create the session as today.
5. Use a transaction so the counter update and audit write are atomic.

**Admin recovery.** Extend `src/app/api/admin/users/route.ts` (or a sibling
`/api/admin/users/unlock`) with an `unlock` action that clears
`failedLoginCount` and `lockedUntil`, requires `instanceAdmin`, and writes
`auth.account.unlocked` with the acting admin's id. Surface an **Unlock** button
and a "locked" badge in the existing admin users UI. Password-reset completion
must also clear the lock (self-service recovery path).

**Enumeration safety.** Never reveal "this account is locked" to an
unauthenticated caller; only differentiate states in audit logs and the admin
view. Optionally surface a precise lock message only *after* a correct password.

**Tests.** Threshold trips lock; escalating backoff; success resets; password
reset clears lock; admin unlock works and is audited; non-admin cannot unlock;
generic error preserves enumeration safety; concurrency (serializable) — two
parallel bad attempts don't double-count past threshold.

**Docs.** Update `docs/operations/SECURITY.md`, `THREAT_MODEL.md`, `API.md`,
`DATABASE_SCHEMA.md`, `DATA_MODEL.md`, `CHANGELOG.md`.

### A2. Security-event review surface

A read-only admin view filtering existing `AuditEvent` rows to security actions
(`auth.signin`, `auth.signin.failed`, `auth.account.locked/unlocked`,
`password-reset.*`). No new storage — reuses the audit log and `[householdId,
createdAt]` / `[userId, createdAt]` indexes. Paginate.

### A3. (Optional) TOTP two-factor auth

Complements lockout. New `UserMfa` (secret encrypted at rest, `confirmedAt`,
recovery codes hashed). Enroll/verify/disable routes; signin gains a second
step when enabled; admin can reset a user's MFA (audited). Defer if v0.6.0 scope
is tight; lockout is the priority.

---

## 5. Phase B — Optimize foundations (v0.7.0)

### B1. Holdings / share tracking *(explicit request)*

**Concept.** Manual-first position tracking for investment and retirement
accounts, with deterministic valuation and cost basis. Holdings are
Optimize-owned (per `AGENTS.md`: "Holdings and performance imports belong to
Optimize, not Analyze"). Budget remains balance-free.

**New models (sketch).**

```prisma
model Holding {
  id          String   @id @default(cuid())
  householdId String
  accountId   String           // links to an INVESTMENT/RETIREMENT Account
  symbol      String?          // e.g. CSPX, optional for unlisted
  name        String
  assetClass  AssetClass       // EQUITY, BOND, FUND, ETF, CASH, CRYPTO, OTHER
  currency    String   @db.VarChar(3)
  active      Boolean  @default(true)
  deletedAt   DateTime?
  // ... timestamps, household relation, lots
}

model HoldingLot {        // cost basis (buy lots)
  id        String  @id @default(cuid())
  holdingId String
  quantity  Decimal @db.Decimal(18,6)
  unitCost  Decimal @db.Decimal(18,4)
  acquiredAt DateTime
}

model HoldingValuation {  // manual or imported price snapshots
  id        String  @id @default(cuid())
  holdingId String
  asOf      DateTime
  unitPrice Decimal @db.Decimal(18,4)
  source    String          // manual | import | rate-feed
}
```

**Lib (`src/lib/optimize/holdings.ts`).** Deterministic: current value =
Σ(quantity × latest unitPrice); cost basis = Σ lots; unrealized gain/loss;
allocation by asset class and by currency; reporting-currency conversion via
`ExchangeRate` with stale-rate warnings. No AI, no live trading.

**Imports (later within B).** Structured holdings/performance imports for
Frankly/VIAC and Saxo per the ingestion priority list — Optimize-side, not the
Analyze parser pipeline. Manual entry ships first.

**API.** `/api/optimize/holdings` CRUD (+ lots, + valuations), entitlement-gated
to `OPTIMIZE`, household-scoped, Zod-validated, audited.

**UI.** Dense positions table (symbol, qty, cost, value, gain, weight), asset-
allocation and currency-exposure charts with tabular alternatives and empty
states per `UI_SPEC.md`.

**Tests.** Valuation golden tests; multi-currency conversion; cost-basis math;
zero/empty states; household isolation; entitlement enforcement.

### B2. Account-derived balance forecasts *(completes deferred v0.3.0)*

Forecast pocket/account balances from committed Analyze actuals plus planned
Budget flows — read-only, deterministic, never writing to Budget. Reconciles to
source rows and states reporting currency. This is already named as remaining
v0.3.0 work; finish it here.

### B3. Persisted scenario comparison *(completes deferred v0.3.0)*

Today `projection.ts` is non-persistent. Add a `ScenarioComparison` model to
save named scenario sets (starting amount, monthly contribution, horizon,
per-scenario return assumptions) for reuse — still no side effects on Budget.

---

## 6. Phase C — Retirement & pensions (v0.8.0)

### C1. Multi-pillar pension vehicles *(extends Pillar 3a)*

**Concept.** Generalize `pillar3a.ts` into a pension model covering the Swiss
three-pillar system (and pluggable country profiles via the existing
`lib/country-profiles` module):

| Pillar | Modeled inputs |
| --- | --- |
| Pillar 1 (AHV/AVS) | Expected state pension estimate (annual), claiming age |
| Pillar 2 (BVG occupational) | Current balance, annual contribution, conversion rate, retirement age |
| Pillar 3a (existing) | Keep current calc; fold into the vehicle model |
| Pillar 3b (free) | Optional balance, expected return |

```prisma
model PensionVehicle {
  id            String      @id @default(cuid())
  householdId   String
  memberId      String?     // attribute to a household member
  pillar        PensionPillar
  currency      String      @db.VarChar(3)
  currentBalance Decimal?   @db.Decimal(18,4)
  annualContribution Decimal? @db.Decimal(18,4)
  expectedReturnRate Decimal? @db.Decimal(8,6)
  retirementAge Int?
  // ... soft delete, audit, household relation
}
```

### C2. Pension vehicle predictions *(explicit request)*

Deterministic projection per vehicle to the retirement year (reuse the
end-of-year annuity math already in `pillar3a.ts`): projected balance,
cumulative contributions vs growth, tax saved (3a), and a combined household
projection across pillars. Ignores inflation by default with an optional
real-terms toggle (see backlog). Every output explainable with `basis[]`.

### C3. Retirement readiness calculator *(explicit request)*

Combine pensions + holdings + emergency fund + savings projections into a single
readiness view:

- **Target retirement income** (user-set, or % replacement of current net
  income).
- **Projected income** from Pillar 1 + annuitized Pillar 2/3a/3b + investment
  drawdown.
- **Gap** and **required additional monthly savings** to close it.
- **Drawdown sustainability** — deterministic safe-withdrawal check (e.g.,
  configurable withdrawal rate over horizon), not a Monte-Carlo black box.

Lib: `src/lib/optimize/retirement.ts`; route `/api/optimize/retirement`; feeds
new entries into `recommendations.ts` (e.g. "increase Pillar 2 buy-in",
"retirement income gap"). Golden tests for each formula.

---

## 7. Phase D — Resilience & goals (v0.9.0)

### D1. Income-protection-aware emergency fund *(explicit request)*

**Concept.** Today `emergency-fund.ts` sizes the target as `essentialMonthly ×
targetMonths`, ignoring insurance. When the household has income protection
(disability/illness cover, unemployment entitlement, sick-pay continuation, or
guaranteed severance), part of essential spending is covered after a waiting
("elimination") period, so the required liquid runway is smaller. Make the
calculation aware of these without breaking the current default.

**New inputs (additive, backward-compatible — absent ⇒ today's behavior).**

```ts
interface IncomeProtection {
  monthlyBenefit: string;       // guaranteed monthly income while out of work
  waitingPeriodMonths: number;  // elimination period before benefit starts
  benefitDurationMonths?: number; // cap on how long benefit pays
  coversPercentOfEssential?: number; // optional cap as % of essential
}
```

**Adjusted target logic (deterministic).**

1. Full essential spend must be self-funded for `waitingPeriodMonths` (no
   benefit yet).
2. After the waiting period, required reserve covers only
   `max(essentialMonthly − monthlyBenefit, 0)` per month, up to `targetMonths`.
3. Effective target = waiting-period cost + reduced post-waiting cost, capped at
   the un-insured target. Multiple earners and severance shorten the exposure
   window further.

Output keeps `status`, `gap`, `monthsCovered`, `suggestedMonthlyContribution`,
and adds an explanation of how protection reduced the target. Recommendations
update accordingly ("your DI cover reduces the target by X; redirect surplus to
Pillar 3a").

**Tests.** No-protection path equals current golden output (regression guard);
waiting-period-only; benefit-reduces-target; benefit ≥ essential (target = just
the waiting window); multi-earner.

### D2. Financial goals / sinking funds

`FinancialGoal` (name, target amount + date, linked account/pocket, priority).
Deterministic required-monthly-contribution and on-track/behind status; surfaces
into recommendations. Optimize-tier.

### D3. Debt payoff calculator

Optimize-only (Budget forbids debt-payoff math). Deterministic avalanche vs
snowball schedules, total interest, payoff date, given balances/rates/min
payments. Lib `src/lib/optimize/debt.ts`; golden tests.

### D4. Net-worth statement

Aggregate holdings (B1) + pension balances (C1) + account-derived balances (B2)
− debts (D3) into a point-in-time net-worth report with reporting currency and
reconciliation to source rows. Strictly Optimize; never surfaced in Budget.

---

## 8. Cross-cutting backlog (unversioned)

| Item | Tier/Area | One-line concept |
| --- | --- | --- |
| FX exposure & currency-risk report | Optimize | Aggregate exposure by currency across pockets + holdings |
| Inflation / real-terms toggle | Optimize | Optional real (after-inflation) projections across all calculators |
| Tax pack export | Optimize/Platform | Year-end CSV/PDF for accountant (contributions, gains, interest) |
| Login & new-device alerts | Security | Email on new-device signin; complements A1/A3 |
| Passkeys / WebAuthn | Security | Phishing-resistant auth, after TOTP |
| Progressive friction / CAPTCHA | Security | Add challenge after repeated failures before hard lock |
| Additional country profiles | Platform | `za` profile shipped (v0.9.5 groundwork); wire FNB/Standard Bank/Investec parsers in once real sanitized fixtures are available |
| Goal/subscription optimizers | Optimize | Extend findings into actionable savings suggestions |

---

## 9. Standard delivery checklist (per feature)

Apply to every item before marking complete:

1. Read `AGENTS.md` + relevant `docs/**`; confirm tier and release fit.
2. Additive Prisma migration; review generated SQL; update `DATA_MODEL.md` +
   `DATABASE_SCHEMA.md`.
3. Shared Zod schema; household scoping + role/entitlement enforcement; FK
   ownership checks.
4. decimal.js math; strings on the wire; reporting currency + reconciliation.
5. Append-only audit events; soft delete; no secret/raw-financial logging.
6. Tests: golden calculations, household isolation, entitlement, audit emission,
   enumeration/lockout safety where relevant.
7. UI per `UI_SPEC.md`: dense tables, chart empty states, tabular alternatives,
   keyboard access, semantic tokens (no raw hex).
8. Run `typecheck`, `lint`, `test`, production `build`; update `API.md`,
   `USER_GUIDE.md`, `ROADMAP.md`, `CHANGELOG.md`.

---

## 10. Suggested sequence & rationale

1. **v0.6.0 (Phase A)** first — security has no upstream dependencies and the
   lockout request is concrete and self-contained.
2. **v0.7.0 (Phase B)** — holdings + valuation are the primitives net worth and
   retirement readiness depend on; also clears the two deferred v0.3.0 items.
3. **v0.8.0 (Phase C)** — pensions/retirement build directly on B's valuation
   and the existing Pillar 3a engine.
4. **v0.9.0 (Phase D)** — emergency-fund insurance logic, goals, debt, and
   net-worth round out Optimize once balances and pensions exist.

Open decisions to confirm before build: lockout threshold/backoff defaults and
whether hard-lock-until-admin is on by default; whether TOTP (A3) is in v0.6.0
or deferred; manual-only vs import holdings scope for v0.7.0; which country
profiles beyond Switzerland are in scope for pensions.
