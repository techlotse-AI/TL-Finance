# Deployment

## Cloud Compose deployment

The primary `compose.yaml` is the supported single-instance cloud deployment.
It sets `init: true` on every service; if you run the images with bare
`docker run` instead, pass `--init` so a proper PID 1 reaps child processes
and forwards signals. It contains no source-build instructions and pulls a
matching versioned image pair from Docker Hub:

```text
techlotse/tl-finance:vX.Y.Z
techlotse/tl-finance-migrator:vX.Y.Z
```

The migrator image contains the committed Prisma migrations and migration CLI.
It runs once after PostgreSQL is healthy. The application starts only after
migrations complete successfully. Always deploy both images with the same
version tag. The original `v0.5.0` release predates the migrator image and is
not compatible with this cloud Compose definition.

On the cloud host, install Docker Engine with the Compose plugin, place
`compose.yaml` and a private `.env` file in a restricted deployment directory,
then configure the environment:

```bash
cp .env.example .env
chmod 600 .env
```

Replace every placeholder. Set `TL_FINANCE_VERSION` to a published versioned
`vX.Y.Z` tag that includes both images. `POSTGRES_PASSWORD` and the password
inside `DATABASE_URL` must refer to the same value; URL-encode special
characters inside `DATABASE_URL`.

Validate and deploy:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs migrate
```

The application binds to `127.0.0.1:3000` by default. Terminate TLS at a host
reverse proxy and forward traffic to that address. Set `NEXT_PUBLIC_APP_URL` to
the exact public HTTPS origin. PostgreSQL is only attached to the internal
Compose database network and has no host-published port.

For scheduled S3-compatible backups:

```bash
docker compose --profile scheduled-backups up -d
```

The application, migrator, and scheduler run with read-only root filesystems
and writable in-memory `/tmp` mounts. PostgreSQL data persists in the named
`postgres-data` volume. Back up that volume or use platform backups before
upgrades.

### Upgrade

Update only `TL_FINANCE_VERSION` after confirming that both versioned images
were published and passed the release vulnerability gate:

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs migrate
```

The one-shot migrator applies additive migrations before the new application
starts. Do not roll the application back across a database migration unless the
release notes explicitly confirm compatibility.

## Local source-build deployment

Local development uses the production definition plus an explicit build
override:

```bash
cp .env.development.example .env
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

This exposes PostgreSQL on `localhost:5432` for local tooling. Never use the
development override or development environment template on a public host.

## Required production controls

Production deployments must provide strong, independent
`AUDIT_IP_HASH_SECRET`, `RATE_LIMIT_HASH_SECRET`,
`SCHEDULED_BACKUP_TOKEN`, and `TOTP_ENCRYPTION_KEY` values (the last encrypts
TOTP secrets at rest; rotating it invalidates every enrolled authenticator), use TLS at the ingress, configure
`INSTANCE_ADMIN_EMAIL` before first signup, enable email verification with
working SMTP, and persist and back up PostgreSQL data.

Review [PUBLIC_DEPLOYMENT_CHECKLIST.md](PUBLIC_DEPLOYMENT_CHECKLIST.md),
[SECURITY.md](SECURITY.md), and [BACKUP_RESTORE.md](BACKUP_RESTORE.md) before
public exposure.

## CI channels: verify, release, and nightly

CI has one gate and two publish channels. The `verify` job runs on every pull
request and every push (branch or tag); nothing is published unless it passes.
The single `publish` job runs only on pushes (never pull requests), after
`verify`, and chooses its channel from the ref:

- **Release — `vX.Y.Z` tag push.** The git tag is the source of truth for the
  version: pushing `v0.8.2` publishes `0.8.2` and moves `latest`. You do **not**
  need to bump `package.json` first.

  ```text
  techlotse/tl-finance:vX.Y.Z
  techlotse/tl-finance:latest
  techlotse/tl-finance-migrator:vX.Y.Z
  techlotse/tl-finance-migrator:latest
  ```

- **Nightly — push to `main` without a tag.** Publishes a moving `nightly` tag
  and the 12-character commit SHA. It never moves `latest`.

  ```text
  techlotse/tl-finance:nightly
  techlotse/tl-finance:<commit-sha>
  techlotse/tl-finance-migrator:nightly
  techlotse/tl-finance-migrator:<commit-sha>
  ```

Both channels build the application and migrator images, scan them with Trivy
(High/Critical), open a GitHub issue for any finding, and **fail the publish on
any Critical** before Docker Hub authentication — so a blocked scan pushes
nothing. Cloud Compose deployments must pin a versioned `vX.Y.Z` tag, never
`latest` or `nightly`.

Configure the GitHub organization secrets `DOCKERHUB_USER` and
`DOCKERHUB_TOKEN` once. To cut a release:

```bash
git tag v0.8.2
git push origin v0.8.2
```

The tag-triggered workflow owns publishing. Optionally first move the
`Unreleased` changelog notes into a dated `v0.8.2` section and keep
`package.json`/`package-lock.json` consistent with each other (the version
check enforces that), but neither is required for the tag to publish.

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

Offline destructive restore uses the version-matched migrator image. See
[BACKUP_RESTORE.md](BACKUP_RESTORE.md).
