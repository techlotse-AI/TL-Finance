# TL-Project — TL-Finance

> Project tracking file. `VERSION`, `CHANGELOG.md` and git tags say what has
> shipped; this file says what is being worked on. The daily TL briefing reads
> **Next task** and **Due date** from here. The plan is in
> [docs/strategy/ROADMAP.md](docs/strategy/ROADMAP.md); history in
> [docs/strategy/HISTORY.md](docs/strategy/HISTORY.md).

| Field | Value |
|---|---|
| Product | Docker-first, privacy-focused household finance app (Budget / Analyze / Optimize) |
| Repo | `techlotse-AI/TL-Finance` |
| Released version | v0.9.4 (2026-07-16). Unreleased on `main`: TOTP 2FA, new-device alerts, goal purpose, Investec parser, CVE remediation |
| Deployment | Production-ready self-host: versioned, vulnerability-gated Docker Hub images; public-auth, rate limiting, scheduled backups, runbooks |
| Target | **1.0.0 public self-host release on 2026-10-28**, six weekly sprints, one PR and one tag per sprint |
| Tracking owner | Ruan |

## Next task

**Sprint 0 — dependency refresh and v0.9.5.** Fold the 12 open Dependabot
PRs into one verified PR, release the work unreleased since v0.9.4 as v0.9.5.
Owner test: E2E checklist §5 (TOTP enrolment, recovery code, new-device
email) on the upgraded deployment.

## Due date

2026-09-18

## Sprint calendar

| Sprint | Due | Tag | Headline |
|---|---|---|---|
| 0 | 2026-09-18 | v0.9.5 | Dependency refresh, release unreleased work |
| 1 | 2026-09-25 | v0.10.0 | Remove paid plans from surface; inflation toggle |
| 2 | 2026-10-02 | v0.11.0 | De-risk glide path (#70); Frankly/VIAC import; FNB CSV flip |
| 3 | 2026-10-09 | v0.12.0 | Plan dashboard part 1: snapshots, assumptions, shell |
| 4 | 2026-10-16 | v0.13.0 | Plan dashboard part 2: trend, goals, recommendations; Saxo import |
| 5 | 2026-10-23 | v0.14.0 | Self-host guide, user guides, fix findings |
| 6 | 2026-10-28 | 1.0.0 | Stabilise, license tidy, release |

## Status log

- 2026-09-16 — **Plan agreed.** Public self-host 1.0.0 in six weekly sprints;
  paid plans removed from the surface, entitlement code kept; must-haves are
  the Plan dashboard with net-worth trend, de-risk glide path and inflation
  toggle; passkeys and other candidates deferred past 1.0.0. Owner supplies
  Frankly/VIAC, Saxo and FNB CSV fixtures by sprint 2 and tests each release
  on a real deployment. Documentation cleanup merged (PR #139).
- 2026-07-18 — v1 plan realignment (superseded; see HISTORY.md).
- 2026-07-16 — v0.9.3 and v0.9.4 released same day; FNB PDF import shipped.
- 2026-06-27 — v0.9.0 released; Phase D complete.
- 2026-06-14 — v0.5.0: first tagged, vulnerability-gated container release.
- 2026-06-06 — Repository bootstrapped; v0.1.0 Budget tier.
