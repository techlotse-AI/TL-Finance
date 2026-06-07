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

Backup scheduling, tested restore, secret rotation, and the complete production
checklist are v0.4.0 release requirements.
