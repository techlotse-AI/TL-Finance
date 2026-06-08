# v0.3.0 / v0.4.0 Release Test Report

Date: 2026-06-08

Tested branch: `main`

Integrated baseline: `51f30dd` (`Complete v0.3.1 platform settings and backups`)

## Verdict

The implemented v0.3.1 code passes the complete repository CI sequence and the
additional runtime security checks below. It is not release-complete for the
product-contract v0.3.0 or v0.4.0 outcomes.

v0.3.0 remains blocked because Analyze is only a foundation and Optimize only
implements the non-persistent deterministic projection comparison slice.

v0.4.0 remains blocked on public-ready authentication, operations, privacy,
restore validation, and independent security review work.

## Verified

- All local branches are contained in `main`; `codex/v0.3.0-optimize` was
  already an ancestor and `codex/v0.3.1-platform-settings` was fast-forwarded.
- Migration safety check and clean PostgreSQL 16.14 migration deployment pass.
- Exact dependency tree resolves; `npm audit --audit-level=moderate` reports
  zero vulnerabilities.
- `npm outdated` reports only the next-major `@types/node` and ESLint releases.
  The repository remains on the Node 24 type line and ESLint 9 compatibility
  line.
- Typecheck, lint, all 45 tests, the focused access suite, and production build
  pass.
- The multi-stage production image builds, runs as `nextjs`, exposes only port
  3000, and reaches healthy status.
- Runtime headers include CSP, HSTS, frame, MIME-sniffing, referrer, and
  permissions protections; `X-Powered-By` is absent.
- Unsafe requests reject untrusted origins, including platform backup and
  exchange-rate refresh. CI now rejects unsafe API methods without explicit
  trusted-origin enforcement.
- Non-administrators receive a clear admin access-denied page and `403` from
  platform APIs; current-admin self-lockout is rejected.
- Authentication rate limiting returns `429` on the eleventh failed sign-in.
- Database reset requires the administrator password and confirmation phrase,
  removes operational and financial data, preserves the current administrator
  and session, preserves append-only audit history, and records the reset.
- Entitled Analyze status and Optimize projection APIs respond successfully.
- Browser checks cover account currencies, Budget item routing and Essential
  explanation, income routing, user backup/settings, platform settings, locked
  tier surfaces, and entitled Analyze/Optimize surfaces with no console errors.
- Required documentation files and weekly npm, GitHub Actions, and Docker
  Dependabot configuration are present.
- A repository secret-pattern scan found no private keys or common provider
  token formats.

## Corrected During Audit

- Platform database reset no longer deletes append-only audit events.
- Platform backup and exchange-rate refresh now enforce trusted-origin checks.

## Release Blockers

### v0.3.0

- No production-ready institution statement parser or fixture-backed import
  commit workflow.
- Actual transaction review, allocation workflow, cash handling,
  transfer/FX confirmation, adherence, actual/comparison graphs, and
  deterministic money-leak findings are incomplete.
- Account-derived forecasts, emergency-fund calculations, persisted scenarios,
  Swiss Pillar 3a calculations, explainable recommendations, and predictions
  are incomplete.

### v0.4.0

- Email verification and password-reset delivery workflows are absent.
- User-facing session management and forced-revocation operations are
  incomplete.
- Authentication rate limiting is process-local and unsuitable for a
  multi-instance public deployment.
- Scheduled backups, automated restore, and tested restore procedures are
  absent.
- Secret rotation, threat model, privacy, incident-response, and complete
  production-runbook documentation are absent.
- Broader privilege-escalation and cross-household route-level test coverage
  plus an independent security review remain required.
- A high/critical production-image CVE scan was not completed in this run
  because the available Docker Scout command would transmit the private image
  package inventory to an external service.
