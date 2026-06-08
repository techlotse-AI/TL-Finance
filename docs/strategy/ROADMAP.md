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

Next, add emergency-fund calculations, persisted scenario comparison,
account-derived forecasts after Analyze is complete, Swiss Pillar 3a
calculations, and explainable recommendations.

## v0.3.1 - Platform settings and portability

Started with authenticated multi-household user Budget backup portability,
instance-administrator user management, audit-log export, on-demand
S3-compatible platform snapshots, protected database reset, supported-currency
account setup, account-and-currency route UX, and free Frankfurter reporting
rate refreshes.

Automated platform restore, scheduled backups, and public-ready operational
validation remain v0.4.0 work.

## v0.4.0 - Public-ready security

Complete independent review and public operations, authentication, privacy, and
incident-response requirements.
