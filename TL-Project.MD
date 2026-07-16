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
| Released version | **v0.9.3** — released 2026-07-16 (git tag `v0.9.3` pushed, `package.json`/`VERSION` aligned at 0.9.3). Bundles v0.9.1 stabilize/secure, v0.9.2 Budget UI (parts 1-2), v0.9.3 Budget visualization/flow, and v0.9.4 Analyze Revolut/UBS hardening under one tag. Full local gate verified green. |
| Deployment | Production-ready — versioned, vulnerability-gated Docker Hub releases; public-auth, rate limiting, scheduled backups, deployment runbooks |
| Tracking owner | Ruan |

## Next task
**v0.9.5 groundwork is up for review (PR #78)** — ZA country profile, dependency-free
OFX 1.x/2.x reader, ZAR allocation/FX-matching confirmed already working. The FNB
parser itself remains unbuilt: no real sanitized fixtures exist, and AGENTS.md
requires at least two before a parser ships. Once #78 lands, next up is
**v0.9.6 — Optimize unified planning dashboard** (see `docs/strategy/ROADMAP.md`):
bring scenarios, emergency fund, Pillar 3a, pensions/retirement, debt payoff,
net-worth, and goals into one **Plan** dashboard with cross-links and a shared
assumptions panel; persist point-in-time net-worth snapshots for a trend line.

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
- **Forward plan:** v0.9.1 stabilize/secure ✅ → v0.9.2–3 Budget UI ✅ →
  v0.9.4 Analyze Revolut/UBS hardening ✅ → v0.9.5 FNB **groundwork done, parser
  blocked on real fixtures** (PR #78) → v0.9.6–7 Optimize planning suite →
  v0.9.8 RC + 1.0.0-alpha.1. Detail in `ROADMAP.md`.
- **Security item #33 CLOSED:** bundled-undici HIGH was in the Node base image;
  auto-closed by the Trivy dedupe gate once the base image was bumped.
- Deferred **TOTP 2FA** from Phase A (capstone in v0.9.8).
- Backlog folded into the plan: FX exposure report, inflation/real-terms toggle,
  tax-pack export, login alerts, passkeys, STYLING.md (shipped), docs/
  consolidation, structured holdings imports (Frankly/VIAC, Saxo). ZA country
  profile shipped in v0.9.5 groundwork; FNB/Standard Bank/Investec parsers
  still need real sanitized fixtures before they can be wired in.

## Status log
- 2026-06-20 — Tracking file created. v0.8.1, working tree clean on `main`; `tsc` passes, 128 tests pass — releasable green state. Pha
- 2026-06-22 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20, "v0.8.2 new release CI"). `package.json` bump to 0.8.2 still pending. Phase D not yet started — next task unchanged.
- 2026-06-23 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. Due 2026-06-27 (4 days out).
- 2026-06-24 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. ⚠️ Due 2026-06-27 (3 days out).
- 2026-06-25 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` now reads `0.8.3` in working tree (ahead of the `v0.8.2` tag — bump/tag not yet committed). Phase D not started — next task unchanged.
- 2026-06-26 — Briefing run. Released **v0.8.6** (git tag `v0.8.6` + `package.json` `0.8.6` now aligned — up from v0.8.2; prior tag/working-tree drift resolved); last commit `6c41398` (2026-06-26, "Update card.tsx"). Owner has advanced the Next Task to **FX currency-exposure report** (D1/D3/D4 shipped by v0.8.3; only D2 financial goals left in Phase D). ⚠️ Due 2026-06-27 (tomorrow).
- 2026-06-26 — **v0.9.0 build pass** (interactive, owner-directed; "final pass before public Alpha"). Implemented: **D2 financial goals** (FinancialGoal model + additive migration `20260626120000_v0_9_0_financial_goals`, golden-tested `optimize/goals.ts`, `/api/optimize/goals` CRUD, Optimize **Goals** tab); **budget analysis** (`budget/analysis.ts` + `/api/budget/analysis` + `BudgetAnalysisPanel` viz on the Budget page: top spend, 50/30/20, savings opportunities, insights); **whole-amount budgeting** (`money/rounding.ts` round-to-nearest-5 + `formatWhole`, **±5 reconciliation tolerance** applied in `money-flow.ts`); **Docker** image optimized (BuildKit cache mounts, leaner layers); **README badges** (release/CI/Trivy/license); **Trivy issue dedupe** in `ci.yml` (update-in-place + close-when-clean); standard files **VERSION/LICENSE.md/CHANGELOG.md/CLAUDE.md**; `version:check` now asserts VERSION. `package.json`→**0.9.0** (+lock). Phase D complete. New pure tests green (rounding 9, goals 11, analysis 9). ⚠️ Prisma-dependent typecheck/build + `money-flow.test.ts` need a **local** run (sandbox limits). Salary-split deferred by owner; Alpha rename (1.0.0-alpha.1) is the next milestone.
- 2026-07-05 — **v0.9.0 RELEASED + status/cleanup pass** (owner-directed). Ran the full local gate green end-to-end: `npm ci`, `prisma generate`, **typecheck ✅**, **lint ✅ clean**, **test ✅ 220 passed / 5 skipped**, **next build ✅** (needs `DATABASE_URL`; CI provides it); `npm audit` clean. Cut the release: annotated git tag **`v0.9.0`** on `main` (ba34659), pushed (triggers the vuln-gated Docker publish). Triaged 7 Dependabot PRs: **merged** #40 lucide-react, #37 recharts, #36 postcss (all CI-green, low-risk, squash+delete); **flagged RISKY** #38 eslint 9→10 and #34 actions/checkout 6→7 (→ `steynru` + `needs-human-review`, not merged); **held** #35/#39 (vitest + coverage-v8 fail unless bumped together). Commented root cause on #33 (undici HIGH is in the **Node base image**, not npm — Dockerfile fix, scheduled v0.9.1; left open). Removed orphaned `.fuse_hidden…` duplicate of this tracker (committed in `f56d863`). Wrote the **v0.9.1→v0.9.8 forward plan** into `ROADMAP.md` (Budget UI / Analyze Revolut+UBS+FNB / Optimize planning suite). Docs/cleanup on branch `chore/v0.9.0-release-cleanup-roadmap` → PR. Note: repo-lives-at path corrected to `techlotse-AI/TL-Finance`; branch-protection ruleset `protect-main` requires 1 approving review.
- 2026-07-16 — **v0.9.3 RELEASED** (owner-directed, interactive session spanning v0.9.1→v0.9.5). v0.9.1 stabilize/secure resolved as a side effect of other work: undici HIGH (#33) auto-closed via the Trivy dedupe gate after a Node base-image bump; vitest/coverage-v8 Dependabot grouping confirmed already fixed; eslint 10 (#38) and TypeScript 7 (#69) majors both parked with `@dependabot ignore` after confirming locally (not just from CI logs) that `eslint-config-next`'s vendored toolchain blocks each. v0.9.2 Budget UI shipped in two PRs: empty/loading/error states + `formatWhole` migrated onto every Budget money display, plus a `BudgetSubNav` unifying six Budget-tier pages and a first-class `/categories` page (moved out of Settings). v0.9.3 Budget visualization/flow shipped: money-flow-graph zoom/pan/print/SVG-export, clickable legend isolation, the accessible table moved into the graph component (fixing a real bug — the old dashboard copy ignored the graph's own view-mode/filter state), analysis split into reusable cards with a server-rendered dashboard summary. v0.9.4 Analyze Revolut+UBS hardening shipped: wired two existing-but-untested fixtures into golden tests, added a genuinely fixture-driven FX-match test, actionable "no parser recognized" errors (lists every parser's rejection reason), and review-queue split-allocation/pagination/bulk-actions (the backend already supported split allocation; the UI never exposed it). v0.9.5 FNB hit a real, disclosed blocker: no FNB fixtures exist anywhere, AGENTS.md requires ≥2 real sanitized fixtures before a parser ships — owner chose "groundwork only, defer the parser" (PR #78, pending review): ZA country profile, dependency-free OFX 1.x/2.x reader (unregistered, spec-based, not FNB-specific), ZAR flows confirmed already working via new tests. Cut the release: `VERSION`/`package.json`/`package-lock.json` bumped to **0.9.3**, `CHANGELOG.md` restructured (`## [Unreleased]` → `## [0.9.3] - 2026-07-16 — "Budget workspace & Analyze hardening"`, bundling v0.9.1-v0.9.4 under one tag per owner's explicit combining preference), full local gate green, annotated git tag **`v0.9.3`** pushed (triggers vuln-gated Docker publish). PR #78 (v0.9.5 groundwork) intentionally left unmerged/untagged — next release.