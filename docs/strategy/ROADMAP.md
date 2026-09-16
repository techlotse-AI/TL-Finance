# Roadmap

**Status: being replanned.** The previous plan, which targeted a public
self-host alpha via v0.9.5 to v0.9.7, is closed. Its history and reasoning are
in [HISTORY.md](HISTORY.md). This file will hold the new roadmap once it is
agreed; until then it lists the open work the new plan has to place or drop.

Every release still has to land the full gate green (`typecheck`, `lint`,
`test`, `build`) and change nothing in a lower tier.

## Inventory of open work

Carried over from the closed plan. Nothing here is scheduled yet.

### Product, previously alpha-blocking

- Unified **Plan** dashboard over the Optimize engines with cross-links and a
  shared assumptions panel.
- Persisted net-worth snapshots for a trend line (additive migration).
- De-risk glide path for wealth projection and drawdown (issue #70, draft PR
  #124 by Copilot).
- Inflation / real-terms toggle across all calculators.
- Structured holdings imports for Frankly/VIAC and Saxo (issue #88, blocked on
  owner-supplied fixtures).

### Release readiness

- Self-host guide: compose quickstart, env-var reference, first run, upgrade
  path, backup and restore walkthrough.
- End-user guide per tier.
- Run `docs/operations/E2E_CHECKLIST.md` on a real deployment; findings become
  issues.
- One full backup-to-restore rehearsal on a release candidate.
- Alpha rename: `VERSION` to `1.0.0-alpha.1`, pre-release tag publishes
  `:alpha`, never `:latest`.

### Housekeeping

- Cut a release for the unreleased changelog (TOTP, device alerts, Investec
  parser, CVE remediation).
- Merge or close the open Dependabot PRs (#126 to #136) and the security PR
  #138 for issue #137.

### Fixture-blocked parsers

FNB CSV second sample (#82), OFX validation against a real export (#83), Zuger
Kantonalbank (#84), Standard Bank (#85). Each needs two real sanitized
fixtures.

### Post-v1 candidates

FX currency-exposure report; tax-pack export; what-if overlays; contributor and
parser guide; automated browser E2E in CI; performance budget; independent
security review; progressive friction or CAPTCHA; passkeys/WebAuthn; OIDC
login; CAMT.053 and QIF import; allocation-rule preview; Monte Carlo mode;
salary-split schedule override.
