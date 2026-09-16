# CLAUDE.md

This project's engineering rules, product boundaries, money discipline, tenancy
model, and migration/audit policy live in **[AGENTS.md](AGENTS.md)**. Read it
first and follow it exactly.

Quick pointers:

- **Tracker:** [TL-Project.MD](TL-Project.MD) (next task, due date)
- **Roadmap:** [docs/strategy/ROADMAP.md](docs/strategy/ROADMAP.md); past plans in [docs/strategy/HISTORY.md](docs/strategy/HISTORY.md)
- **Docs index:** [docs/README.md](docs/README.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Versioning:** `VERSION` and `package.json` are kept in sync; git tags drive releases.
- **Money:** stored as `Decimal(18,4)`, computed with decimal.js, strings on the
  wire. The budget is a whole-amount ("zero-cent") budget — figures are presented
  rounded to the nearest 5 and reconciliation tolerates ±5 (see
  `src/lib/money/rounding.ts`).
- **Verify before pushing:** `npm run typecheck && npm run lint && npm test && npm run build`.
