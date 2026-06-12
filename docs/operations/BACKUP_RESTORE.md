# Backup and Restore

## Scheduled backups

Configure S3 variables and a random `SCHEDULED_BACKUP_TOKEN`, then start:

```bash
docker compose --profile scheduled-backups up -d
```

The scheduler invokes the protected backup endpoint once at startup and every
24 hours. Production schedulers may call the same endpoint with the
`x-tl-finance-backup-token` header. Monitor scheduler logs and S3 lifecycle
policy independently.

## Restore rehearsal

Restores are intentionally offline and destructive. Stop application traffic,
download and verify a platform JSON backup, then run:

```bash
export DATABASE_URL='postgresql://...'
export TL_FINANCE_RESTORE_CONFIRMATION='RESTORE PLATFORM DATABASE'
npm run platform:restore -- /secure/path/platform-backup.json
```

The restore validates the backup format, replaces platform data in one database
transaction, and revokes all previous sessions. Start the application, sign in,
and verify households, Analyze counts, tiers, audit history, and a fresh backup.

Rehearse restore at least quarterly and before major upgrades. Never test a
restore against production.
