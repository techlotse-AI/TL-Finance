# Incident Response

## Immediate containment

1. Remove public ingress or place the deployment in maintenance mode.
2. Preserve PostgreSQL, ingress, application, SMTP, S3, and audit logs.
3. Revoke affected users or all sessions.
4. Rotate scheduler, SMTP, S3, audit-hash, and rate-limit secrets as applicable.
5. Take an encrypted platform backup before corrective database work.

## Investigation

- Establish the affected users, households, resources, and time window.
- Export audit events and correlate them with ingress and provider logs.
- Treat statement files, backup objects, and email delivery logs as sensitive.
- Document decisions and preserve evidence without adding secrets to tickets.

## Recovery

1. Patch and verify the root cause in a non-production environment.
2. Restore from a tested backup when integrity is uncertain.
3. Run the complete CI and v0.4 readiness checks.
4. Re-enable ingress gradually and monitor authentication, authorization, and
   backup events.

## Notification

The operator owns legal and contractual notification obligations. Notify
affected users with concrete scope, dates, exposed data categories, containment
steps, and recommended user actions. Do not speculate.
