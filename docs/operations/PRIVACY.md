# Privacy

TL Finance is self-hosted and stores financial data in the operator-controlled
PostgreSQL database.

- Raw financial descriptions are not sent to AI providers by default.
- Frankfurter receives only currency-pair requests.
- SMTP receives account email addresses and account-link messages.
- S3-compatible platform backups contain password hashes, users, household
  financial data, entitlements, and audit history. They exclude sessions and
  one-time authentication tokens.
- Audit events store a keyed hash of an IP address, never the raw address.
- User backup exports omit credentials, sessions, audit history, deleted rows,
  and Analyze source facts.

Operators must publish their own retention policy, protect database and backup
access, configure provider retention, and fulfill deletion/export obligations
for their jurisdiction.
