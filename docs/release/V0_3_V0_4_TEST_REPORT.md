# v0.3.0 / v0.4.0 Release Test Report

Date: 2026-06-09

Tested branch: `main` working tree before the v0.4.0 commit

## Verdict

The v0.3 deterministic Optimize scope and v0.4.0 code/documentation scope are
implemented and pass the complete local verification sequence.

Public exposure remains an operator decision. Each deployment must complete a
restore rehearsal, production container vulnerability scan, SMTP/S3 integration
test, and independent security assessment using the public deployment
checklist.

## Implemented

- Complete Analyze import/review/allocation/transfer/adherence/findings workflow
- Deterministic Optimize scenarios, emergency fund, Swiss Pillar 3a, and
  explainable recommendations
- SMTP-backed email verification and password-reset flows
- Hashed one-time tokens with expiry and single use
- Password-reset revocation of all user sessions
- User-facing active-session listing and revocation
- PostgreSQL-backed shared authentication rate limits
- Scheduler-token-protected S3-compatible platform backups
- Offline destructive full-platform restore
- Threat model, privacy, incident-response, backup/restore, secret-rotation,
  and public-deployment runbooks
- v0.4 readiness and unsafe-route CI checks

## Verified

- Additive v0.4 migration applied to PostgreSQL 16
- Typecheck and lint pass
- 75 tests pass, including the database-backed household isolation suite
- Focused access suite passes
- Migration safety, API security, and v0.4 readiness checks pass
- Production Next.js build passes and exposes all expected v0.4 routes

## Deployment Gates

- Test actual SMTP delivery with the production provider.
- Test S3 upload and an offline restore rehearsal with production-like data.
- Run the chosen production-image vulnerability scanner.
- Complete independent security review and record approval.
