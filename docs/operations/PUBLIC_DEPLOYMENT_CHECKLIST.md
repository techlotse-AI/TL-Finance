# Public Deployment Checklist

- [ ] TLS ingress is configured and `NEXT_PUBLIC_APP_URL` is the exact public origin.
- [ ] `TL_FINANCE_VERSION` is pinned to a published versioned `vX.Y.Z` tag;
      neither application image uses `latest`.
- [ ] `docker compose config --quiet` passes and `docker compose pull` retrieves
      both the application and migrator images before rollout.
- [ ] PostgreSQL has no host-published port and the application port is only
      reachable through the intended TLS ingress.
- [ ] `AUDIT_IP_HASH_SECRET`, `RATE_LIMIT_HASH_SECRET`, and
      `SCHEDULED_BACKUP_TOKEN` are independent random values of at least 32
      characters.
- [ ] `EMAIL_VERIFICATION_REQUIRED=true` and SMTP delivery is tested.
- [ ] `INSTANCE_ADMIN_EMAIL` is set to the intended initial administrator
      before signup is exposed publicly.
- [ ] Database is private, backed up, monitored, and restored successfully in a
      rehearsal environment.
- [ ] S3 backup bucket is private, encrypted, least-privilege, and lifecycle
      protected.
- [ ] Scheduled backup logs and failed jobs are monitored.
- [ ] `npm run v0.4:readiness`, full CI, dependency audit, and container scan pass.
- [ ] GitHub organization secrets `DOCKERHUB_USER` and `DOCKERHUB_TOKEN` are
      configured, and the versioned application and migrator release workflow
      completed without Critical container vulnerabilities.
- [ ] Cross-household and administrator access tests pass.
- [ ] Threat model, privacy policy, incident response, and secret rotation are
      reviewed by the operator.
- [ ] An independent security reviewer has approved the deployment.
