# TL Finance

TL Finance is a Docker-first, privacy-focused household finance application.
The **Budget tier is implemented**, the Analyze foundation and Optimize
calculator have started, and v0.3.1 adds platform operations and data
portability. No institution statement parser is production-ready without its
required sanitized fixtures.

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
