# Security

Baseline security is required from v0.1.0.

- Sessions are database-backed, revocable, and represented by secure HTTP-only
  cookies. Only token hashes are stored.
- Passwords use a strong adaptive hash.
- `HouseholdMember` is the authorization boundary for household data.
- Unsafe requests require a trusted origin and CSRF validation.
- Paid capability checks are server-side.
- When `INSTANCE_ADMIN_EMAIL` is configured, only the account matching that
  normalized email at signup becomes the initial instance administrator. When
  it is blank, the first registered user becomes administrator. First-user
  assignment runs in a serializable transaction to prevent concurrent signup
  races. Public deployments must configure the email before exposure.
- Mutations write append-only audit events.
- IP metadata is hashed with a dedicated server secret before persistence.
- Production errors do not expose Prisma errors, stack traces, or secrets.
- Response headers enforce a same-origin content security policy, HSTS,
  framing and MIME-sniffing protection, strict referrer behavior, and
  restricted browser capabilities.
- Authentication endpoints use PostgreSQL-backed shared rate-limit buckets
  keyed by HMAC values rather than raw identifiers.
- Email-verification and password-reset links use random one-time tokens that
  are hashed at rest. Password reset revokes every active user session.
- Users can list and revoke their other active sessions.
- CI installs from the lockfile, runs the dependency audit at moderate
  severity, rejects unsafe API methods without an explicit trusted-origin
  check, and pins third-party GitHub Actions to immutable verified commits.
- Dependabot monitors npm, GitHub Actions, and Docker dependencies weekly.
- Platform settings require the persisted `instanceAdmin` flag server-side.
  Non-administrators receive an explicit access-denied page instead of a
  server-component exception.
- User activation and administrator-role changes are audited, revoke sessions
  when a user is deactivated, prevent current-user self-lockout, and preserve
  at least one active platform administrator.
- Platform database reset requires instance-administrator access, the current
  administrator password, and the exact `RESET PLATFORM DATABASE` confirmation.
  It preserves that administrator, the current session, and the append-only
  audit history, then writes a new post-reset audit event.
- Platform backup credentials remain server-side environment variables. Backup
  objects request AES256 server-side encryption by default and include password
  hashes, so the destination bucket must be private. The explicit `none`
  compatibility mode is acceptable only when the storage provider enforces
  encryption independently.
- User-backup and audit-log exports emit security audit events. Audit-log CSV
  export is instance-administrator-only and capped at the newest 50,000 events.

Public deployment runbooks cover the threat model, privacy, incident response,
backup/restore, secret rotation, and deployment checks. An independent security
review remains an operator gate before public exposure.
