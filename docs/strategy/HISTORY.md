# History — timeline and superseded plans

Short record of what shipped when, and of the plans that drove it. This file
replaces the long-form roadmap prose, the improvement-roadmap proposal, the
daily briefings, and the per-release status reports that used to live under
`docs/`. Detailed release notes remain in [`CHANGELOG.md`](../../CHANGELOG.md)
(v0.9.0 onward) and [`docs/release/CHANGELOG.md`](../release/CHANGELOG.md)
(v0.1 to v0.8.8).

## Timeline

Dates are git-tag dates where a tag exists, otherwise the migration or commit
date. Early milestones (v0.1 to v0.4) were not tagged.

| Version | Date | What shipped |
|---|---|---|
| v0.1.0 | 2026-06-06 | Budget tier: income routing, accounts and pockets, transfers, budget items, monthly normalization, planned money-flow graph, household export/import, baseline security |
| v0.2.0 | 2026-06-07 | Analyze tier: UBS account, UBS card, Revolut and generic CSV parsers, review queue, allocation rules, transfer and FX matching, adherence, money-leak findings |
| v0.3.0 / v0.3.1 | 2026-06-08 | Optimize deterministic tools (scenarios, emergency fund, Pillar 3a, recommendations); instance admin, audit export, S3 snapshots, exchange-rate refresh |
| v0.4.0 | 2026-06-09 | Public-ready security: email verification, password reset, shared rate limiting, session revocation, scheduled backups, offline restore, operations runbooks |
| v0.5.0 | 2026-06-14 | Tag-driven, Trivy-gated Docker Hub releases (`techlotse/tl-finance` plus migrator image) |
| v0.7.0 / v0.7.5 | 2026-06-16 | Holdings and lots with valuation, balance forecasts, persisted scenarios; Swiss pensions (AHV scale 44, pillars 2/3a/3b), retirement readiness |
| v0.8.0 | 2026-06-17 | Account lockout with escalating backoff, admin unlock, security-event surface; Optimize launched |
| v0.8.3 to v0.8.9 | 2026-06-24 to 06-27 | Income-protection-aware emergency fund, debt payoff, net-worth statement, BVG projection override, in-place budget editing, audit-log filtering, spending accounts, pure-budget and account-minimums graph views |
| v0.9.0 | 2026-06-27 | Financial goals, budget spend and savings analysis, whole-amount (round-to-5) budgeting with ±5 tolerance, standard repo files (VERSION, LICENSE, CHANGELOG, CLAUDE.md), Trivy issue dedupe |
| v0.9.3 | 2026-07-16 | Bundled milestones v0.9.1 to v0.9.4: Budget workspace UI and sub-nav, money-flow zoom/pan/export, analysis cards, Revolut and UBS golden-test hardening, review-queue split allocation and bulk actions |
| v0.9.4 | 2026-07-16 | FNB Private Clients PDF parser (production-ready) and CSV parser (held), ZA country profile, OFX 1.x/2.x reader, `unpdf` as the first locked-stack exception |
| unreleased | 2026-07-18 to 08-27 | v1 plan realignment and E2E checklist; TOTP 2FA and new-device alerts; goal and wealth-plan purpose (#41); migrator and runner image slimming; CVE remediation; Investec CCM PDF parser (#86); dependency bumps |

Activity after 2026-08-27 was limited to Dependabot PRs and a bot-authored
security PR (#138 for issue #137). No release has been cut since v0.9.4.

## Superseded plans

Each plan below is closed. It is listed so the reasoning is not lost, not so
it is followed.

1. **Original build contract (June 2026).** Five releases, v0.1.0 to v0.5.0,
   one per tier plus security and container releases. All five shipped by
   2026-06-14. The tier boundaries and engineering rules it introduced are the
   part that survives, in `AGENTS.md`.
2. **Improvement roadmap proposal (2026-06-20).** Four phases: A account
   security (v0.6), B Optimize foundations (v0.7), C pensions and retirement
   (v0.8), D resilience and goals (v0.9). All four shipped by v0.9.0. Its
   cross-cutting backlog (FX exposure, inflation toggle, tax pack, login
   alerts, passkeys, CAPTCHA, more country profiles) was carried forward.
3. **Forward plan (2026-07-05).** Milestones v0.9.1 to v0.9.5 across three
   tracks: Budget UI, Analyze hardening (Revolut, UBS, FNB), Optimize planning
   suite. Shipped, but compressed into two tags at the owner's request, which
   left milestone numbers out of step with tag numbers.
4. **v1 plan realignment (2026-07-18).** Defined `1.0.0-alpha.1` as a public
   self-host alpha and renumbered so milestone equals tag: v0.9.5 unified Plan
   dashboard with shared assumptions and persisted net-worth snapshots; v0.9.6
   future planning (de-risk glide path #70, purpose #41, inflation toggle,
   holdings imports if fixtures arrive); v0.9.7 release candidate with four
   gates (TOTP and device alerts, self-host and per-tier user guides, E2E
   checklist run plus restore rehearsal, alpha rename). Of this plan only the
   security gate and #41 shipped. The dashboard was due 2026-07-25 and was not
   started. #70 exists as draft PR #124.
5. **TL standard migration (`MIGRATION.md`).** Brought the repo in line with
   the shared Techlotse template: VERSION file, top-level CHANGELOG, LICENSE,
   STYLING.md, CLAUDE.md pointer, Dependabot grouping, alpha publish channel
   in CI, version check accepting pre-release tags. Done except the deliberate
   `1.0.0-alpha.1` rename step. The docs consolidation and `AGENTS.md` trim it
   asked for were completed by the cleanup that created this file.

## Decisions worth remembering

- Statement parsers need two real sanitized fixtures before they are marked
  production-ready. FNB CSV, OFX, Zuger Kantonalbank and Standard Bank are all
  blocked on this (issues #82 to #85).
- Structured formats before PDF. `unpdf` was admitted only because FNB's real
  workflow is emailed PDF statements and the structured parsers were already
  production-ready.
- Optimize never mutates Budget. Budget never holds balances, forecasts or
  actuals.
- Whole-amount budgeting: figures shown rounded to the nearest 5, stored
  exact, reconciliation tolerates ±5.
- The eslint 10 and TypeScript 7 majors are parked with `@dependabot ignore`
  because `eslint-config-next` pins an older toolchain.
- A September 2026 comparison against the open-source Securo project
  concluded that TL Finance should keep its own codebase and license, and
  compete on planned money routing and Swiss and South African planning rather
  than on ledger breadth or bank sync.
