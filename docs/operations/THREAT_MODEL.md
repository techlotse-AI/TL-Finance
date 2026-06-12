# Threat Model

## Protected assets

- User credentials, sessions, email verification and password-reset tokens
- Household membership, entitlements, planned budgets, imported transactions,
  allocations, and recommendations
- Platform backups, SMTP credentials, S3 credentials, and audit history

## Trust boundaries

- Browser to TLS ingress
- Ingress to the Next.js application
- Application to PostgreSQL, SMTP, S3-compatible storage, and Frankfurter
- Administrator and scheduler access to platform operations

## Primary threats and controls

| Threat | Control |
| --- | --- |
| Cross-household access | Mandatory `householdId` scoping, membership checks, ownership tests |
| Privilege escalation | Server-side role, entitlement, and `instanceAdmin` checks |
| Credential stuffing | Strong password policy and PostgreSQL-backed shared rate limits |
| Session theft | Random hashed tokens, secure HTTP-only cookies, revocation UI, reset revocation |
| CSRF / hostile origins | Trusted-origin checks on unsafe browser routes |
| Token disclosure | Verification/reset tokens are hashed at rest and expire |
| Backup disclosure | Private S3 bucket, least-privilege credentials, requested server-side encryption |
| Scheduler abuse | Separate high-entropy scheduler token with timing-safe comparison |
| SQL/ORM error disclosure | Validated input and production-safe error responses |
| Supply-chain compromise | Lockfile installs, immutable GitHub Actions, dependency audit, Dependabot |
| Malicious statement files | Bounded fail-closed deterministic parsers and preview-before-commit |

## Accepted limitations

- Public deployments must terminate TLS at a trusted ingress.
- SMTP and S3 operators can observe data sent to their services.
- Process memory contains decrypted request data while a request is handled.
- An independent security assessment remains required before exposing a new
  production deployment to untrusted public traffic.
