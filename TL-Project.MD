# TL-Project — TL-Finance

> **Project tracking file.** This is *not* a release or version file — `package.json`,
> `CHANGELOG.md` and git tags remain authoritative for what has shipped. This file tracks
> the **work**: what's next, when it's due, and a running status log.
>
> The daily TL briefing reads **Next Task** and **Due Date** from this file. It reads
> *Released Version* and *Last Commit* automatically from git/version files. Keep the two
> fields below current as priorities change — everything else is context.

| Field | Value |
|---|---|
| Product | Docker-first, privacy-focused household finance app (Budget / Analyze / Optimize) |
| Repo | `D:\LocalCode\TL-Finance` |
| Released version | `package.json` **0.9.0** (working tree) — pending commit + git tag `v0.9.0`. Last released tag was v0.8.6. |
| Deployment | Production-ready — versioned, vulnerability-gated Docker Hub releases; public-auth, rate limiting, scheduled backups, deployment runbooks |
| Tracking owner | Ruan |

## Next task
**Commit + tag `v0.9.0`, then run the full local gate** (`npm run generate && npm run typecheck && npm run lint && npm test && npm run build`) to confirm the v0.9.0 pass green — the sandbox can't run Prisma-dependent typecheck/build. Then proceed to the **public Alpha rename** (MIGRATION.md): `1.0.0-alpha.1` + alpha channel (relax `version:check` for pre-release tags first), `STYLING.md`, `docs/` consolidation, migrator-image release matrix.

## Due date
2026-06-27

## Outstanding / backlog
- **Phase D: COMPLETE.** D1 (emergency fund), D2 (financial goals — this pass), D3 (debt), D4 (net-worth) all shipped.
- v0.9.0 pass (2026-06-26, this session): D2 goals (schema+migration+engine+API+UI), budget analysis + visualizations, whole-amount rounding-to-5 + ±5 reconciliation tolerance, Docker optimization, README badges, Trivy issue dedupe, VERSION/LICENSE/CHANGELOG/CLAUDE.md. **Needs local verification** (see Next task).
- Deferred **TOTP 2FA** from Phase A.
- Backlog: FX exposure report, inflation/real-terms toggle, tax-pack export, login alerts, passkeys, ZA country profile, STYLING.md, docs/ consolidation.
- Sandbox cannot run `prisma generate` (engine download blocked) → full `tsc`/`vitest`/`build` must be confirmed locally; pure golden tests pass (rounding 9, goals 11, budget-analysis 9; optimize+money 81 total). `money-flow.test.ts` couldn't run in-sandbox (mount served a truncated copy) — re-run locally.

## Status log
- 2026-06-20 — Tracking file created. v0.8.1, working tree clean on `main`; `tsc` passes, 128 tests pass — releasable green state. Pha
- 2026-06-22 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20, "v0.8.2 new release CI"). `package.json` bump to 0.8.2 still pending. Phase D not yet started — next task unchanged.
- 2026-06-23 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. Due 2026-06-27 (4 days out).
- 2026-06-24 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. ⚠️ Due 2026-06-27 (3 days out).
- 2026-06-25 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` now reads `0.8.3` in working tree (ahead of the `v0.8.2` tag — bump/tag not yet committed). Phase D not started — next task unchanged.
- 2026-06-26 — Briefing run. Released **v0.8.6** (git tag `v0.8.6` + `package.json` `0.8.6` now aligned — up from v0.8.2; prior tag/working-tree drift resolved); last commit `6c41398` (2026-06-26, "Update card.tsx"). Owner has advanced the Next Task to **FX currency-exposure report** (D1/D3/D4 shipped by v0.8.3; only D2 financial goals left in Phase D). ⚠️ Due 2026-06-27 (tomorrow).
- 2026-06-26 — **v0.9.0 build pass** (interactive, owner-directed; "final pass before public Alpha"). Implemented: **D2 financial goals** (FinancialGoal model + additive migration `20260626120000_v0_9_0_financial_goals`, golden-tested `optimize/goals.ts`, `/api/optimize/goals` CRUD, Optimize **Goals** tab); **budget analysis** (`budget/analysis.ts` + `/api/budget/analysis` + `BudgetAnalysisPanel` viz on the Budget page: top spend, 50/30/20, savings opportunities, insights); **whole-amount budgeting** (`money/rounding.ts` round-to-nearest-5 + `formatWhole`, **±5 reconciliation tolerance** applied in `money-flow.ts`); **Docker** image optimized (BuildKit cache mounts, leaner layers); **README badges** (release/CI/Trivy/license); **Trivy issue dedupe** in `ci.yml` (update-in-place + close-when-clean); standard files **VERSION/LICENSE.md/CHANGELOG.md/CLAUDE.md**; `version:check` now asserts VERSION. `package.json`→**0.9.0** (+lock). Phase D complete. New pure tests green (rounding 9, goals 11, analysis 9). ⚠️ Prisma-dependent typecheck/build + `money-flow.test.ts` need a **local** run (sandbox limits). Salary-split deferred by owner; Alpha rename (1.0.0-alpha.1) is the next milestone.