# Dependency Compatibility

Dependency state was reviewed on June 7, 2026.

All direct application packages use the latest stable npm release except where
the supported runtime or an upstream peer dependency requires a compatibility
pin:

- `eslint` is pinned to `9.39.4`, the newest release supported by the React,
  accessibility, and import plugins bundled with `eslint-config-next@16.2.7`.
  ESLint 10.4.1 crashes those plugins before source linting begins.
- `@types/node` is pinned to the latest Node 24 line so compile-time APIs match
  the Node 24.16.0 LTS production runtime.
- PostgreSQL is pinned to `16.14`, the latest patch in the repository's locked
  PostgreSQL 16 major version.

The lockfile overrides vulnerable transitive versions of PostCSS,
`@hono/node-server`, and esbuild with patched releases.
`npm audit --audit-level=moderate` reports zero vulnerabilities.

GitHub Actions uses the latest verified releases of `actions/checkout` and
`actions/setup-node`, pinned to immutable commits. Container release scanning
uses the official Trivy Action pinned to an immutable commit.
Dependabot monitors npm, GitHub Actions, and Docker updates weekly.
The production image upgrades Alpine runtime packages during the final image
stage so fixed base-image security updates are applied before container scans.
