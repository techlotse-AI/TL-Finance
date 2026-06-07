# API Reference

Implemented endpoints:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns a non-sensitive application health result |
| `POST` | `/api/auth/signup` | Validates credentials, hashes the password, creates a revocable session, and audits the event |
| `POST` | `/api/auth/signin` | Verifies credentials, creates a revocable session, and audits the event |
| `POST` | `/api/auth/signout` | Revokes the current session and audits the event |
| `GET, POST` | `/api/household`, `/api/household/active` | Lists, creates, and selects accessible households |
| `GET, POST, PATCH, DELETE` | `/api/category-groups/*`, `/api/categories/*`, `/api/accounts/*`, `/api/account-pockets/*`, `/api/income-sources/*`, `/api/planned-transfers/*`, `/api/budget-items/*` | Household-scoped Budget resources |
| `GET` | `/api/budget/monthly-summary`, `/api/budget/money-flow` | Persisted normalized plan and graph |
| `GET, POST` | `/api/members/*`, `/api/admin/tiers`, `/api/exchange-rates` | Membership, manual entitlement, and reporting-rate administration |
| `GET, POST` | `/api/household/export`, `/api/household/import` | Validated household portability |
| `GET` | `/api/analysis/status` | Entitled Analyze foundation counts |
| `POST` | `/api/analysis/imports/preview` | Fail-closed parser preview; writes import metadata but no transactions |
| `POST` | `/api/optimize/projections` | Entitled, non-persistent deterministic scenario comparison |
