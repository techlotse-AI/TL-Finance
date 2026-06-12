# Secret Rotation

Rotate secrets one class at a time and record the date without recording the
secret value.

| Secret | Rotation effect |
| --- | --- |
| `SCHEDULED_BACKUP_TOKEN` | Update scheduler and app together; old scheduled calls fail |
| SMTP password | Update provider and app; verify reset and verification delivery |
| S3 access key | Grant new least-privilege key, test backup, then revoke old key |
| `RATE_LIMIT_HASH_SECRET` | Existing rate-limit buckets become unreachable and expire |
| `AUDIT_IP_HASH_SECRET` | Future IP hashes no longer correlate with previous hashes |

After suspected session compromise, revoke sessions through Settings or user
administration. Password reset revokes every session for the affected user.
