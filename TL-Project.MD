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
| Released version | v0.8.6 (authoritative: git tag `v0.8.6`; `package.json` `0.8.6` aligned ✅) |
| Deployment | Production-ready — versioned, vulnerability-gated Docker Hub releases; public-auth, rate limiting, scheduled backups, deployment runbooks |
| Tracking owner | Ruan |

## Next task
**FX currency-exposure report** (`src/lib/optimize/fx-exposure.ts`) — self-contained, golden-tested, **no schema migration**; reuses the `ExchangeRate` cache + net-worth rate-map. Add Optimize tab + `/api/optimize/fx-exposure` route. Shippable in a day. _(Then: D2 financial goals / sinking funds — the last remaining Phase D feature, but it needs a `FinancialGoal` migration, so plan it as a dated multi-day milestone.)_

## Due date
2026-06-27  _(FX report — adjust as needed)_

## Outstanding / backlog
- **Phase D remainder: only D2 financial goals / sinking funds** left. D1 (emergency fund), D3 (debt), D4 (net-worth) all shipped by v0.8.3.
- Repo hygiene gap for a sellable product: root still missing `LICENSE`, `VERSION`, `CLAUDE.md`, `STYLING.md` — pick a license deliberately (proprietary/EULA vs OSS).
- Deferred **TOTP 2FA** from Phase A.
- Backlog: inflation/real-terms toggle, tax-pack export, login alerts, passkeys, ZA country profile.
- Sandbox cannot run `prisma generate` (engine download blocked) → full `tsc`/`vitest` must be confirmed locally; pure golden tests pass (59/59 in `src/lib/optimize`).

## Status log
- 2026-06-20 — Tracking file created. v0.8.1, working tree clean on `main`; `tsc` passes, 128 tests pass — releasable green state. Pha
- 2026-06-22 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20, "v0.8.2 new release CI"). `package.json` bump to 0.8.2 still pending. Phase D not yet started — next task unchanged.
- 2026-06-23 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. Due 2026-06-27 (4 days out).
- 2026-06-24 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` still 0.8.1 (bump pending). Phase D not started — next task unchanged. ⚠️ Due 2026-06-27 (3 days out).
- 2026-06-25 — Briefing run. Released v0.8.2 (git tag); last commit `1278f55` (2026-06-20). `package.json` now reads `0.8.3` in working tree (ahead of the `v0.8.2` tag — bump/tag not yet committed). Phase D not started — next task unchanged.
- 2026-06-26 — Briefing run. Released **v0.8.6** (git tag `v0.8.6` + `package.json` `0.8.6` now aligned — up from v0.8.2; prior tag/working-tree drift resolved); last commit `6c41398` (2026-06-26, "Update card.tsx"). Owner has advanced the Next Task to **FX currency-exposure report** (D1/D3/D4 shipped by v0.8.3; only D2 financial goals left in Phase D). ⚠️ Due 2026-06-27 (tomorrow). 