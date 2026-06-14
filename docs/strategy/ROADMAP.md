# Roadmap

## v0.1.0 - Budget

Implemented planned income routing, accounts and pockets, transfers, budget
items, monthly reconciliation, planned money-flow, locked later-tier surfaces,
household export/import, and baseline security.

## v0.2.0 - Analyze

Implemented. Production-ready structured statement import (UBS account, UBS card,
Revolut, and a generic CSV template) with fail-closed parsing and idempotent
commit; actual transactions and a review queue; deterministic allocation rules
with bulk application; internal-transfer and cross-currency FX matching with
high-confidence auto-confirmation; planned-versus-actual adherence; and
deterministic money-leak findings. Remaining institution parsers (Zuger
Kantonalbank, FNB, Standard Bank, Investec, Frankly/VIAC, Saxo) are added as
sanitized fixtures become available.

## v0.3.0 - Optimize

Started with an entitlement-protected, non-persistent deterministic scenario
comparison calculator. It uses explicit starting amounts, monthly contributions,
annual-return assumptions, and time horizons without changing Budget records.

Now also includes deterministic emergency-fund sizing (from Essential budget
items), Swiss Pillar 3a calculations (2026 limits, remaining headroom, tax
saving, and growth projection), and ranked, explainable recommendations that
combine the emergency-fund gap, Pillar 3a headroom, and Analyze findings.

Remaining v0.3.0 work: persisted scenario comparison and account-derived
balance forecasts built on committed Analyze actuals.

## v0.3.1 - Platform settings and portability

Started with authenticated multi-household user Budget backup portability,
instance-administrator user management, audit-log export, on-demand
S3-compatible platform snapshots, protected database reset, supported-currency
account setup, account-and-currency route UX, and free Frankfurter reporting
rate refreshes.

Automated platform restore, scheduled backups, and public-ready operational
validation remain v0.4.0 work.

## v0.4.0 - Public-ready security

Implemented public email verification and password reset delivery, shared
database-backed rate limiting, user session revocation, scheduled S3-compatible
backups, offline full-platform restore, v0.4 readiness checks, and public
operations/privacy/security runbooks. Every deployment still requires its own
restore rehearsal, container scan, and independent security approval before
public exposure.

## v0.5.0 - Versioned container releases

Implemented tag-driven Docker Hub publishing for `techlotse/tl-finance`.
Release tags must match the canonical package version. The release workflow
reports every High and Critical container vulnerability in a GitHub issue,
blocks publishing on Critical findings, and publishes matching `vX.Y.Z` and
`latest` tags only after verification succeeds.
