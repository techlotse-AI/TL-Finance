# Deployment

The supported development deployment uses Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

Compose applies committed Prisma migrations through a one-shot migration
container before starting the application container. The current runtime is
Node.js 24.16.0 with PostgreSQL 16.14.

Production deployments must provide a strong `AUDIT_IP_HASH_SECRET`, use TLS at
the ingress, run Prisma migrations before application rollout, and persist
PostgreSQL data outside the application container.

Public deployments must also set an independent `RATE_LIMIT_HASH_SECRET`,
configure SMTP, set `EMAIL_VERIFICATION_REQUIRED=true`, and configure a random
`SCHEDULED_BACKUP_TOKEN`.

## Versioned Docker Hub releases

`package.json` is the canonical application version. The CI release job runs
only for tags matching `v*.*.*`, requires the tag to equal
`v${package.json.version}`, and publishes:

```text
techlotse/tl-finance:vX.Y.Z
techlotse/tl-finance:latest
```

Configure the GitHub organization secrets `DOCKERHUB_USER` and
`DOCKERHUB_TOKEN` before creating a release tag. The release candidate is
scanned before Docker Hub authentication or publishing. Every High or Critical
finding is included in a new GitHub issue. Critical findings fail the release
and prevent both image tags from being pushed.

For each release:

1. Update the semantic version in `package.json` and `package-lock.json`.
2. Move the release notes from `Unreleased` into a dated changelog section.
3. Run `npm run version:check` and the normal verification suite.
4. Commit the release and create the matching annotated tag, for example
   `git tag -a v0.5.0 -m "Release v0.5.0"`.
5. Push `main` and the version tag. The tag-triggered workflow owns publishing.

## S3-compatible platform backups

Platform settings can upload an on-demand JSON snapshot to private
S3-compatible storage. Configure:

```text
S3_BACKUP_ENDPOINT
S3_BACKUP_REGION
S3_BACKUP_BUCKET
S3_BACKUP_PREFIX
S3_BACKUP_ACCESS_KEY_ID
S3_BACKUP_SECRET_ACCESS_KEY
S3_BACKUP_FORCE_PATH_STYLE
S3_BACKUP_SERVER_SIDE_ENCRYPTION
S3_BACKUP_KMS_KEY_ID
```

`S3_BACKUP_ENDPOINT` may be empty for AWS S3. The endpoint is required for
providers such as MinIO. Use a dedicated least-privilege credential that can
only write to the backup prefix. Server-side encryption defaults to `AES256`;
`aws:kms` additionally requires `S3_BACKUP_KMS_KEY_ID`. Set encryption to
`none` only when an S3-compatible provider rejects encryption headers and the
private bucket enforces encryption independently. The bucket must enforce
retention and lifecycle policy independently.

Platform snapshots contain all users, password hashes, household financial
data, entitlements, and audit events. They deliberately exclude live sessions,
email-verification tokens, and password-reset tokens.

Scheduled backups can run through the Compose `scheduled-backups` profile.
Offline destructive restore uses `npm run platform:restore -- <backup.json>`.
See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) and
[PUBLIC_DEPLOYMENT_CHECKLIST.md](PUBLIC_DEPLOYMENT_CHECKLIST.md).
