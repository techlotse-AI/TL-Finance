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
| Repo | `techlotse-AI/TL-Finance` (GitHub) |
| Released version | **v0.9.0** — released 2026-07-05 (git tag `v0.9.0` pushed, `package.json`/`VERSION` aligned at 0.9.0). Full local gate verified green. |
| Deployment | Production-ready — versioned, vulnerability-gated Docker Hub releases; public-auth, rate limiting, scheduled backups, deployment runbooks |
| Tracking owner | Ruan |

## Next task
**Start v0.9.1 — Stabilize & secure** (see the v0.9.1→v0.9.8 forward plan in
`docs/strategy/ROADMAP.md`). Concretely: (1) bump the Dockerfile Node base image
to a patch bundling undici ≥ 6.27.0 and confirm a clean Trivy scan → closes #33;
(2) group `vitest` + `@vitest/coverage-v8` in Dependabot so they bump together
(unblocks #35/#39) and review/adopt eslint 10 (#38) and actions/checkout 7 (#34);
(3) fix CI so the tag-only `publish` check doesn't leave PRs permanently
`BLOCKED`; (4) seed `STYLING.md` + design tokens for the Budget-UI track.

## Due date
2026-07-18

## Outstanding / backlog
- **v0.9.0 RELEASED (2026-07-05).** Tag `v0.9.0` pushed on `main`; full local gate
  verified green (typecheck, lint, **220 tests**, next build). Triaged Dependabot:
  merged safe minors/patches (lucide-react #40, recharts #37, postcss #36);
  flagged RISKY per policy (eslint 10 major #38, actions/checkout 7 #34 →
  `steynru` + `needs-human-review`); held the failing vitest pair (#35/#39, must
  bump together). Removed an orphaned duplicate `TL-Project.MD` committed under a
  FUSE placeholder filename.
- **Phase D: COMPLETE.** D1 (emergency fund), D2 (financial goals), D3 (debt),
  D4 (net-worth) all shipped.
- **Forward plan set:** v0.9.1 stabilize/secure → v0.9.2–3 Budget UI →
  v0.9.4–5 Analyze (Revolut/UBS hardening, then FNB) → v0.9.6–7 Optimize
  planning suite → v0.9.8 RC + 1.0.0-alpha.1. Detail in `ROADMAP.md`.
- **Open security item #33:** bundled-undici HIGH lives in the Node base image,
  not npm; remediation is the Dockerfile base-image bump (scheduled in v0.9.1).
- Deferred **TOTP 2FA** from Phase A (capstone in v0.9.8).
- Backlog folded into the plan: FX exposure report, inflation/real-terms toggle,
  tax-pack export, login alerts, passkeys, ZA country profile, STYLING.md,
  docs/ consolidation, structured holdings imports (Frankly/VIAC, Saxo).

## Status log
- 2026-06-20 — Tracking file created. v0.8.1, working tree clean on `main`; `tsc` passes, 128 tests pass — releasable green state. Pha
- 2026-06-22 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20, "v0.8.2 new release CI"). `package.json` bump to 0.8.2 still pending. Phase D not yet started — next task unchanged.
- 2026-06-23 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. Due 2026-06-27 (4 days out).
- 2026-06-24 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. ⚠️ Due 2026-06-27 (3 days out).
- 2026-06-25 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` now reads `0.8.3` in working tree (ahead of the `v0.8.2` tag — bump/tag not yet committed). Phase D not started — next task unchanged.
- 2026-06-26 — Briefing run. Released **v0.8.6** (git tag `v0.8.6` + `package.json` `0.8.6` now aligned — up from v0.8.2; prior tag/working-tree drift resolved); last commit `6c41398` (2026-06-26, "Update card.tsx"). Owner has advanced the Next Task to **FX currency-exposure report** (D1/D3/D4 shipped by v0.8.3; only D2 financial goals left in Phase D). ⚠️ Due 2026-06-27 (tomorrow).
- 2026-06-26 — **v0.9.0 build pass** (interactive, owner-directed; "final pass before public Alpha"). Implemented: **D2 financial goals** (FinancialGoal model + additive migration `20260626120000_v0_9_0_financial_goals`, golden-tested `optimize/goals.ts`, `/api/optimize/goals` CRUD, Optimize **Goals** tab); **budget analysis** (`budget/analysis.ts` + `/api/budget/analysis` + `BudgetAnalysisPanel` viz on the Budget page: top spend, 50/30/20, savings opportunities, insights); **whole-amount budgeting** (`money/rounding.ts` round-to-nearest-5 + `formatWhole`, **±5 reconciliation tolerance** applied in `money-flow.ts`); **Docker** image optimized (BuildKit cache mounts, leaner layers); **README badges** (release/CI/Trivy/license); **Trivy issue dedupe** in `ci.yml` (update-in-place + close-when-clean); standard files **VERSION/LICENSE.md/CHANGELOG.md/CLAUDE.md**; `version:check` now asserts VERSION. `package.json`→**0.9.0** (+lock). Phase D complete. New pure tests green (rounding 9, goals 11, analysis 9). ⚠️ Prisma-dependent typecheck/build + `money-flow.test.ts` need a **local** run (sandbox limits). Salary-split deferred by owner; Alpha rename (1.0.0-alpha.1) is the next milestone.
- 2026-07-05 — **v0.9.0 RELEASED + status/cleanup pass** (owner-directed). Ran the full local gate green end-to-end: `npm ci`, `prisma generate`, **typecheck ✅**, **lint ✅ clean**, **test ✅ 220 passed / 5 skipped**, **next build ✅** (needs `DATABASE_URL`; CI provides it); `npm audit` clean. Cut the release: annotated git tag **`v0.9.0`** on `main` (ba34659), pushed (triggers the vuln-gated Docker publish). Triaged 7 Dependabot PRs: **merged** #40 lucide-react, #37 recharts, #36 postcss (all CI-green, low-risk, squash+delete); **flagged RISKY** #38 eslint 9→10 and #34 actions/checkout 6→7 (→ `steynru` + `needs-human-review`, not merged); **held** #35/#39 (vitest + coverage-v8 fail unless bumped together). Commented root cause on #33 (undici HIGH is in the **Node base image**, not npm — Dockerfile fix, scheduled v0.9.1; left open). Removed orphaned `.fuse_hidden…` duplicate of this tracker (committed in `f56d863`). Wrote the **v0.9.1→v0.9.8 forward plan** into `ROADMAP.md` (Budget UI / Analyze Revolut+UBS+FNB / Optimize planning suite). Docs/cleanup on branch `chore/v0.9.0-release-cleanup-roadmap` → PR. Note: repo-lives-at path corrected to `techlotse-AI/TL-Finance`; branch-protection ruleset `protect-main` requires 1 approving review.