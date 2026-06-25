# MIGRATION — TL-Finance → TL standard

Brings this repo in line with the shared TL engineering standard (see
`tl-template`). Work top to bottom.

## Target identity
| Field | Value |
|---|---|
| Repo name | **TL-Finance** (no rename — already without `-Core`) |
| Docker image | `techlotse/tl-finance` (+ `techlotse/tl-finance-migrator`) |
| Version target | **`1.0.0-alpha.1`** — public alpha |
| Release channel | **alpha** (`:vX.Y.Z-alpha.N` + `:alpha`, not `:latest`) |
| Live URL | https://tl-finance-core.techlotse.cloud/ |

## 1. Rename
None. Confirm Docker image is `techlotse/tl-finance` (drop any `-core`).

## 2. Versioning
- Add a top-level **`VERSION`** file as the single source of truth: `1.0.0-alpha.1`.
- Keep the existing `npm run version:check` but point it at `VERSION` (assert `package.json` matches).
- Tag releases `vX.Y.Z-alpha.N`; the tag drives the Docker Hub release.

## 3. Release process (TL standard — identical across all repos)
On merge/push to `main` via `.github/workflows/release.yml`:
- **HEAD has tag `vX.Y.Z`** → push `techlotse/tl-finance:vX.Y.Z` + `:latest` + GitHub Release.
- **HEAD has pre-release `vX.Y.Z-alpha.N`** → push `:vX.Y.Z-alpha.N` + `:alpha`. ← Finance uses this now.
- **No tag on HEAD** → push `:<short-sha>` + `:nightly`.
- Multi-arch (amd64/arm64), SBOM + provenance, Docker Hub via `ORG_DOCKERHUB_USER/KEY`.
- Copy `release.yml` from `tl-template`; set `IMAGE: techlotse/tl-finance`. Add a second push step (or matrix) for the migrator image.
- Keep your existing deep `ci.yml` verify gate — it already exceeds the template `ci.yml`.

## 4. Security gate
Trivy gates on **CRITICAL only** (`ignore-unfixed`, `exit-code: 1`). Finance currently has **no image CVE gate** — add the Trivy step to `release.yml`.

## 5. Dependabot
Add `.github/dependabot.yml` (npm + docker + github-actions, weekly).

## 6. Required files (current gaps)
- [x] README.md — refresh to the standard layout; add working badges (release / CI / docker / license).
- [ ] **VERSION** — add (see §2).
- [ ] **CHANGELOG.md** — move from `docs/release/CHANGELOG.md` to top-level, Keep a Changelog with `[Unreleased]`.
- [ ] **LICENSE.md** — add (Techlotse Source-Available; Finance has none today).
- [ ] **AGENTS.md** — keep (already 550 lines); add a `CLAUDE.md` pointer to it. Trim to the standard sections.
- [ ] **STYLING.md** — add (brand/style guide).
- [ ] **TL-Project.md** — already present.

## 7. /docs structure
Consolidate the rich `docs/` (architecture, design, operations, product, strategy, release, reference) into the standard set: `ARCHITECTURE.md`, `DESIGN.md`, `OPERATIONS.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `API-REFERENCE.md`, `DB-SCHEMA.md` (Prisma), `DEPENDENCIES.md`.

## Checklist
- [ ] VERSION = 1.0.0-alpha.1, package.json matches
- [ ] release.yml (alpha channel) + Trivy CRITICAL gate
- [ ] dependabot.yml
- [ ] CHANGELOG.md top-level · LICENSE.md · STYLING.md · CLAUDE.md pointer
- [ ] README badges working · docs/ consolidated
