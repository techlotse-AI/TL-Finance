# Roadmap — six sprints to 1.0.0

Agreed 2026-09-16. Superseded plans are in [HISTORY.md](HISTORY.md).

## Target

**1.0.0 on 2026-10-28: a public self-host release.** Strangers can
`docker pull` and run TL Finance for their own household from the docs alone.
Source-available license as in `LICENSE.md`. All three tiers (Budget, Analyze,
Optimize) available to every household; paid plans are removed from the
product surface and docs, while the entitlement code and data model stay in the
backend for a possible later return.

## Working model

- One sprint per week. The builder (an agent session) works a sprint in a day;
  the owner spends about 30 minutes a week on it.
- Each sprint delivers **one PR** and, once merged, **one tagged release**
  (Trivy-gated, Docker-published), cut by running the CI workflow on `main`
  with the version as input (see `docs/operations/DEPLOYMENT.md`). The owner
  upgrades their real deployment and runs that sprint's section of
  `docs/operations/E2E_CHECKLIST.md`.
  Findings become issues and are fixed in the next sprint before new work.
- Every release lands the full gate green (`typecheck`, `lint`, `test`,
  `build`) and changes nothing in a lower tier.
- Versions: v0.9.5 (sprint 0), then v0.10.0 to v0.14.0, then 1.0.0.

## Sprint plan

| Sprint | Due | Tag | Scope | Owner test |
|---|---|---|---|---|
| 0 | 2026-09-18 | v0.9.5 | Dependency refresh (the 12 open Dependabot PRs folded into one verified PR). Release the work unreleased since v0.9.4: TOTP 2FA, new-device alerts, goal purpose, Investec parser, CVE remediation | §5 security: enrol TOTP, recovery code, new-device email |
| 1 | 2026-09-25 | v0.10.0 | **Remove paid plans from the surface.** Every household resolves to the Optimize tier; locked-tier pages, upgrade badges, admin tier assignment UI and tier wording in docs and `AGENTS.md` removed; entitlement checks, `TierEntitlement` model and admin API kept. **Inflation / real-terms toggle** across all Optimize calculators | §4 Optimize: every tab open for a fresh household; real-terms toggle changes projections consistently |
| 2 | 2026-10-02 | v0.11.0 | **De-risk glide path (#70):** age-indexed return schedule through wealth projection and drawdown, starting from draft PR #124 if it holds up. **Holdings import, part 1:** Frankly/VIAC parser from owner-supplied fixtures. **FNB CSV** flipped to production-ready when the second sample lands | §3 Analyze: import the real Frankly/VIAC and FNB CSV files; §4: glide path on a wealth plan |
| 3 | 2026-10-09 | v0.12.0 | **Plan dashboard, part 1:** persisted net-worth snapshots (additive migration, the first new table since `WealthPlan`), shared assumptions panel, dashboard shell with cross-links into every engine | §4: take snapshots, change an assumption and see every card follow |
| 4 | 2026-10-16 | v0.13.0 | **Plan dashboard, part 2:** net-worth trend from snapshots, goal progress alongside it, recommendations surfaced on the dashboard. **Holdings import, part 2:** Saxo parser from owner fixtures | §4: full dashboard walk-through; §3: Saxo import |
| 5 | 2026-10-23 | v0.14.0 | **Docs gate:** self-host guide (compose quickstart, env-var reference, first run, upgrade, backup and restore walkthrough), end-user guide per tier including statement imports, README refresh. E2E checklist gains a Plan dashboard section. Fix everything found in weeks 1 to 4 | §1 install from the guide on a clean machine; §6 backup and restore rehearsal |
| 6 | 2026-10-28 | 1.0.0 | **Stabilise and release.** Fix week-5 findings, tidy `LICENSE.md` wording, remove the alpha-channel scaffolding (1.0.0 publishes `:latest`), bump `VERSION`, tag | Full checklist, sign-off |

## What the owner supplies

- **By end of sprint 2 (2026-10-02):** real, sanitized exports for Frankly or
  VIAC, Saxo, and a second FNB transaction-history CSV. Two real statements
  per institution. Attach them to the sprint session; they are used locally
  for format verification and never committed. Sanitized means names, account
  numbers and addresses replaced; amounts, dates and structure real.
- **Each week:** upgrade the real deployment to the sprint's tag and run the
  listed checklist section. A one-line finding per problem is enough.
- **Each week:** approve and merge the sprint PR from the GrAv3n-Code account
  (the PRs are authored by steynru, so that account cannot approve them).

If the fixtures do not arrive by sprint 2, holdings imports drop to post-1.0
and their sprint time goes to dashboard polish. Nothing else depends on them.

## Explicitly out of scope until after 1.0.0

Passkeys/WebAuthn; OIDC login; CAMT.053 and QIF import; Zuger Kantonalbank
and Standard Bank parsers (#84, #85); OFX validation against a real export
(#83); FX currency-exposure report; tax-pack export; what-if overlays; Monte
Carlo mode; salary-split schedule override; allocation-rule preview;
automated browser E2E in CI; performance budget; independent security review;
progressive friction or CAPTCHA; contributor and parser guide.

## Definition of done for 1.0.0

1. Every sprint tag published; `verify` and the Trivy gate green on the
   1.0.0 tag.
2. Owner has completed the full E2E checklist on the 1.0.0 candidate and one
   backup-to-restore rehearsal, with no open findings.
3. A stranger can install from `docs/operations/SELF_HOST.md` without the
   maintainer.
4. No paid-tier wording anywhere in the UI or docs.
