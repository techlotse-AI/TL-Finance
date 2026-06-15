# Backup and Restore

## Scheduled backups

Configure S3 variables and a random `SCHEDULED_BACKUP_TOKEN`, then start:

```bash
docker compose --profile scheduled-backups up -d
```

The scheduler invokes the protected backup endpoint once at startup and every
24 hours. Production schedulers may call the same endpoint with the
`x-tl-finance-backup-token` header. Monitor scheduler logs and S3 lifecycle
policy independently. Cloud Compose uses the same version-pinned application
image for the scheduler; local source builds additionally require
`-f compose.yaml -f compose.dev.yaml`.

## Restore rehearsal

Restores are intentionally offline and destructive. Stop application traffic,
download and verify a platform JSON backup, then run the version-matched
migrator image. This example mounts the host `/secure/restore` directory
read-only and restores `/restore/platform-backup.json`:

```bash
docker compose stop app backup-scheduler
docker compose run --rm \
  -e TL_FINANCE_RESTORE_CONFIRMATION='RESTORE PLATFORM DATABASE' \
  -v /secure/restore:/restore:ro \
  migrate node scripts/restore-platform-backup.mjs /restore/platform-backup.json
docker compose up -d
```

The restore validates the backup format, replaces platform data in one database
transaction, and revokes all previous sessions. Start the application, sign in,
and verify households, Analyze counts, tiers, audit history, and a fresh backup.

Rehearse restore at least quarterly and before major upgrades. Never test a
restore against production.
