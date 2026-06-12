# API Reference

Implemented endpoints:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns a non-sensitive application health result |
| `POST` | `/api/auth/signup` | Validates credentials, hashes the password, creates a revocable session, and audits the event |
| `POST` | `/api/auth/signin` | Verifies credentials, creates a revocable session, and audits the event |
| `POST` | `/api/auth/signout` | Revokes the current session and audits the event |
| `POST` | `/api/auth/verify-email/request`, `/api/auth/verify-email/complete` | Issues and consumes hashed email-verification tokens |
| `POST` | `/api/auth/password-reset/request`, `/api/auth/password-reset/complete` | Issues and consumes password-reset tokens; completion revokes all sessions |
| `GET, DELETE` | `/api/auth/sessions`, `/api/auth/sessions/{id}` | Lists active sessions and revokes a selected non-current session |
| `GET, POST` | `/api/household`, `/api/household/active` | Lists, creates, and selects accessible households |
| `GET, POST, PATCH, DELETE` | `/api/category-groups/*`, `/api/categories/*`, `/api/accounts/*`, `/api/account-pockets/*`, `/api/income-sources/*`, `/api/planned-transfers/*`, `/api/budget-items/*` | Household-scoped Budget resources |
| `GET` | `/api/budget/monthly-summary`, `/api/budget/money-flow` | Persisted normalized plan and graph |
| `GET, POST` | `/api/members/*`, `/api/admin/tiers`, `/api/exchange-rates` | Membership, manual entitlement, and reporting-rate administration |
| `POST` | `/api/exchange-rates/refresh` | Household-admin refresh of free Frankfurter institutional reference rates |
| `GET, POST` | `/api/household/export`, `/api/household/import` | Validated household portability |
| `GET, POST` | `/api/user/backup/export`, `/api/user/backup/import` | Authenticated multi-household user Budget backup portability |
| `POST` | `/api/admin/users` | Instance-admin user activation and administrator-role management |
| `POST` | `/api/admin/platform-backup` | Instance-admin S3-compatible platform snapshot upload |
| `POST` | `/api/system/scheduled-backup` | Scheduler-token-protected S3-compatible platform snapshot upload |
| `GET` | `/api/admin/audit-export` | Instance-admin audit-event CSV export, limited to the newest 50,000 events |
| `POST` | `/api/admin/database-reset` | Instance-admin destructive reset with exact confirmation and current-password verification |
| `GET` | `/api/analysis/status` | Entitled Analyze counts and production-ready parser catalog |
| `POST` | `/api/analysis/imports/preview` | Fail-closed parser preview; writes import metadata but no transactions |
| `GET, POST` | `/api/analysis/imports`, `/api/analysis/imports/commit` | Lists imports and idempotently commits parsed transactions |
| `GET` | `/api/analysis/transactions` | Household-scoped actuals with review-state counts |
| `POST` | `/api/analysis/transactions/{id}/allocate`, `/api/analysis/transactions/{id}/ignore` | Manual or split allocation and ignore toggle |
| `GET, POST` | `/api/analysis/rules`, `/api/analysis/rules/apply` | Deterministic allocation rules and bulk application |
| `GET, POST` | `/api/analysis/transfers`, `/api/analysis/transfers/scan` | Transfer/FX match listing and candidate scanning |
| `PATCH` | `/api/analysis/transfers/{id}` | Confirm or reject a transfer match |
| `GET` | `/api/analysis/adherence`, `/api/analysis/findings` | Planned-versus-actual adherence and deterministic money-leak findings |
| `POST` | `/api/optimize/projections` | Entitled, non-persistent deterministic scenario comparison |
| `POST` | `/api/optimize/emergency-fund` | Emergency-fund sizing from essential monthly spend, reserve, and target months |
| `POST` | `/api/optimize/pillar-3a` | Swiss Pillar 3a maximum, remaining headroom, tax saving, and growth projection |
| `POST` | `/api/optimize/recommendations` | Ranked, explainable recommendations from emergency fund, Pillar 3a, and Analyze findings |
