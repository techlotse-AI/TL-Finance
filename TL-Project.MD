# TL-Project — TL-Finance

> Project tracking file. `VERSION`, `CHANGELOG.md` and git tags say what has
> shipped; this file says what is being worked on. The daily TL briefing reads
> **Next task** and **Due date** from here. History lives in
> [docs/strategy/HISTORY.md](docs/strategy/HISTORY.md).

| Field | Value |
|---|---|
| Product | Docker-first, privacy-focused household finance app (Budget / Analyze / Optimize) |
| Repo | `techlotse-AI/TL-Finance` |
| Released version | v0.9.4 (2026-07-16). Unreleased on `main`: TOTP 2FA, new-device alerts, goal purpose, Investec parser, CVE remediation |
| Deployment | Production-ready self-host: versioned, vulnerability-gated Docker Hub images; public-auth, rate limiting, scheduled backups, runbooks |
| Tracking owner | Ruan |

## Next task

Agree a new roadmap and project plan. Inputs: the open-work inventory in
[docs/strategy/ROADMAP.md](docs/strategy/ROADMAP.md) and the closed plans in
[docs/strategy/HISTORY.md](docs/strategy/HISTORY.md). Once agreed, the first
milestone replaces this line.

## Due date

2026-09-30 (placeholder until the new roadmap is agreed)

## Status log

- 2026-09-16 — Documentation cleanup. Roadmap prose, improvement-roadmap
  proposal, daily briefings, release status reports, `BUILD_PROMPT.md` and
  `MIGRATION.md` folded into `docs/strategy/HISTORY.md`; `AGENTS.md` trimmed
  to rules; `ROADMAP.md` reduced to an inventory pending the new plan.
  Competitor comparison against Securo: decision to keep building.
- 2026-07-18 — v1 plan realignment: `1.0.0-alpha.1` defined as public
  self-host alpha with four gates; milestones renumbered to match tags.
- 2026-07-16 — v0.9.3 and v0.9.4 released same day; FNB PDF import shipped.
- 2026-06-27 — v0.9.0 released; Phase D complete.
- 2026-06-14 — v0.5.0: first tagged, vulnerability-gated container release.
- 2026-06-06 — Repository bootstrapped; v0.1.0 Budget tier.
