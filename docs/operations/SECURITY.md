# Security

Baseline security is required from v0.1.0.

- Sessions are database-backed, revocable, and represented by secure HTTP-only
  cookies. Only token hashes are stored.
- Passwords use a strong adaptive hash.
- `HouseholdMember` is the authorization boundary for household data.
- Unsafe requests require a trusted origin and CSRF validation.
- Paid capability checks are server-side.
- The account matching `INSTANCE_ADMIN_EMAIL` at signup becomes the initial
  instance administrator; later tier changes require that server-side flag.
- Mutations write append-only audit events.
- IP metadata is hashed with a dedicated server secret before persistence.
- Production errors do not expose Prisma errors, stack traces, or secrets.
- Response headers enforce a same-origin content security policy, HSTS,
  framing and MIME-sniffing protection, strict referrer behavior, and
  restricted browser capabilities.
- Authentication endpoints use a process-local baseline rate limiter. A
  multi-instance deployment must replace it with a shared limiter before public
  exposure.
- CI installs from the lockfile, runs the dependency audit at moderate
  severity, and pins third-party GitHub Actions to immutable verified commits.
- Dependabot monitors npm, GitHub Actions, and Docker dependencies weekly.
- Platform settings require the persisted `instanceAdmin` flag server-side.
  Non-administrators receive an explicit access-denied page instead of a
  server-component exception.
- User activation and administrator-role changes are audited, revoke sessions
  when a user is deactivated, prevent current-user self-lockout, and preserve
  at least one active platform administrator.
- Platform database reset requires instance-administrator access, the current
  administrator password, and the exact `RESET PLATFORM DATABASE` confirmation.
  It preserves only that administrator and current session, then writes a new
  post-reset audit event.
- Platform backup credentials remain server-side environment variables. Backup
  objects request AES256 server-side encryption by default and include password
  hashes, so the destination bucket must be private. The explicit `none`
  compatibility mode is acceptable only when the storage provider enforces
  encryption independently.
- User-backup and audit-log exports emit security audit events. Audit-log CSV
  export is instance-administrator-only and capped at the newest 50,000 events.

The complete public-ready threat model, independent review, reset and
verification delivery, backup/restore validation, and incident response are
planned for v0.4.0.
