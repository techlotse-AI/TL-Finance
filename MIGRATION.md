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
- [x] README.md — refresh to the standard layout; add working badges (release / CI / docker / license). _(v0.9.0: release, CI, Trivy security-gate, license badges added.)_
- [x] **VERSION** — add (see §2). _(v0.9.0: `0.9.0`; `version:check` now asserts package.json matches it.)_
- [x] **CHANGELOG.md** — move from `docs/release/CHANGELOG.md` to top-level, Keep a Changelog with `[Unreleased]`. _(v0.9.0: top-level CHANGELOG added pointing to the historical log.)_
- [x] **LICENSE.md** — add (Techlotse Source-Available; Finance has none today). _(v0.9.0: added — flagged for legal review before public Alpha.)_
- [x] **AGENTS.md** — keep; add a `CLAUDE.md` pointer to it. _(v0.9.0: `CLAUDE.md` pointer added. Trim to standard sections still pending.)_
- [ ] **STYLING.md** — add (brand/style guide).
- [x] **TL-Project.md** — already present.

## 7. /docs structure
Consolidate the rich `docs/` (architecture, design, operations, product, strategy, release, reference) into the standard set: `ARCHITECTURE.md`, `DESIGN.md`, `OPERATIONS.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `API-REFERENCE.md`, `DB-SCHEMA.md` (Prisma), `DEPENDENCIES.md`.

## Checklist
- [~] VERSION + package.json match — **done at `0.9.0`** (this is the final v0.9.0 pass). The `1.0.0-alpha.1` retarget + alpha release channel is the deliberate next step; note `version:check` currently requires clean `x.y.z`, so moving to `-alpha.N` needs that regex relaxed first.
- [~] Trivy CRITICAL gate — **present in `ci.yml`** (HIGH,CRITICAL scan, CRITICAL blocks publish) and now **dedupes the tracking issue** (updates in place / closes when clean). A separate `release.yml` per the template was not split out; the existing `ci.yml` verify+publish already covers it.
- [x] dependabot.yml — already present (npm + docker + github-actions, weekly).
- [x] CHANGELOG.md top-level · LICENSE.md · CLAUDE.md pointer — **done**. STYLING.md still pending.
- [x] README badges working · [ ] docs/ consolidated — badges **done**; `docs/` consolidation into the standard set still pending.

> **v0.9.0 audit (2026-06-26):** Items above marked done/[~] were completed or
> advanced in the v0.9.0 pass. Remaining for the Alpha rename: `STYLING.md`,
> `docs/` consolidation, the `1.0.0-alpha.1` version retarget + alpha channel
> (`:vX.Y.Z-alpha.N` / `:alpha`) and relaxing `version:check` to accept
> pre-release tags, the migrator-image release matrix, and trimming `AGENTS.md`.
