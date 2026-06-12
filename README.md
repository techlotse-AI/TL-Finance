# TL Finance

TL Finance is a Docker-first, privacy-focused household finance application.
The Budget and Analyze tiers are implemented. Optimize includes deterministic
scenarios, emergency-fund sizing, Swiss Pillar 3a calculations, and explainable
recommendations. v0.4.0 adds public-auth flows, shared rate limiting, session
controls, scheduled backups, offline restore, and public deployment runbooks.

Budget models planned money routes without account balances or forecasts:

```text
Income source -> receiving account currency -> planned transfers
              -> payment category -> budget item
```

## Local development

Requirements:

- Docker Desktop with Compose
- Node.js 24.16.0 when running outside Docker

```bash
cp .env.example .env
docker compose up --build
```

The application is available at `http://localhost:3000`. PostgreSQL is exposed
on `localhost:5432` for local tooling.

## Verification

```bash
npm run generate
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/README.md](docs/README.md) for the product and engineering
documentation index.
