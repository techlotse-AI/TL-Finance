# TL Finance

[![Release](https://img.shields.io/github/v/release/techlotse-AI/TL-Finance?sort=semver&label=release)](https://github.com/techlotse-AI/TL-Finance/releases)
[![CI](https://github.com/techlotse-AI/TL-Finance/actions/workflows/ci.yml/badge.svg)](https://github.com/techlotse-AI/TL-Finance/actions/workflows/ci.yml)
[![Security gate: Trivy CRITICAL](https://img.shields.io/badge/security%20gate-Trivy%20CRITICAL-2ea44f?logo=aquasec&logoColor=white)](https://github.com/techlotse-AI/TL-Finance/actions/workflows/ci.yml)
[![License: Source-Available](https://img.shields.io/badge/license-Source--Available-blue)](LICENSE.md)

TL Finance is a Docker-first, privacy-focused household finance application
with three tiers. **Budget** plans money routes without balances or forecasts.
**Analyze** imports bank statements (UBS, Revolut, FNB, Investec, generic CSV)
and reconciles them against the plan. **Optimize** runs deterministic,
explainable planning: scenarios, emergency fund, debt payoff, net worth, goals,
Swiss pensions and retirement readiness. Releases are versioned,
vulnerability-gated Docker Hub images with public-auth, rate limiting, TOTP
two-factor authentication, scheduled backups and offline restore.

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
cp .env.development.example .env
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

The application is available at `http://localhost:3000`. PostgreSQL is exposed
on `localhost:5432` for local tooling.

## Cloud deployment

Cloud instances pull matching versioned application and migrator images
published to Docker Hub. No source checkout or image build is required:

```bash
cp .env.example .env
# Replace every placeholder and pin TL_FINANCE_VERSION to a published vX.Y.Z tag.
docker compose pull
docker compose up -d
```

The application binds to `127.0.0.1:3000` by default for a host TLS reverse
proxy. PostgreSQL is not published outside the Compose network. See
[Deployment](docs/operations/DEPLOYMENT.md) before exposing an instance.

## Verification

```bash
npm run generate
npm run compose:check
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/README.md](docs/README.md) for the product and engineering
documentation index.
