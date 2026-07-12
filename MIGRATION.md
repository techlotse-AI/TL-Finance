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
- Multi-arch (amd64/arm64), SBOM + provenance, Docker Hub via `DOCKERHUB_USER/TOKEN`.
- **Resolved (v0.9.0):** rather than split out a separate `release.yml`, the existing
  deep `ci.yml` gained the parametric `publish` job (tag `vX.Y.Z` → versioned image +
  `:latest`; `main` → `:nightly` + short-sha). It already exceeds the template, so no
  copy from `tl-template` was needed. Migrator image is built and pushed in the same job.
  Docker Hub creds are **org-level secrets** on `techlotse-AI` (`DOCKERHUB_USER`/`DOCKERHUB_TOKEN`).

## 4. Security gate
Trivy gates on CRITICAL. **Resolved (v0.9.0):** the gate lives in `ci.yml`'s `publish`
job — it scans both images for `HIGH,CRITICAL`, and the "Block publish on Critical"
step fails the release when `critical_count != 0`. Verified firing on the v0.9.0 tag run.

## 5. Dependabot
Add `.github/dependabot.yml` (npm + docker + github-actions, weekly).

## 6. Required files (current gaps)
- [x] README.md — refresh to the standard layout; add working badges (release / CI / docker / license). _(v0.9.0: release, CI, Trivy security-gate, license badges added.)_
- [x] **VERSION** — add (see §2). _(v0.9.0: `0.9.0`; `version:check` now asserts package.json matches it.)_
- [x] **CHANGELOG.md** — move from `docs/release/CHANGELOG.md` to top-level, Keep a Changelog with `[Unreleased]`. _(v0.9.0: top-level CHANGELOG added pointing to the historical log.)_
- [x] **LICENSE.md** — add (Techlotse Source-Available; Finance has none today). _(v0.9.0: added — flagged for legal review before public Alpha.)_
- [x] **AGENTS.md** — keep; add a `CLAUDE.md` pointer to it. _(v0.9.0: `CLAUDE.md` pointer added. Trim to standard sections still pending.)_
- [x] **STYLING.md** — add (brand/style guide). _(Added: quick reference pointing at `docs/design/UI_SPEC.md`.)_
- [x] **TL-Project.md** — already present.

## 7. /docs structure
Consolidate the rich `docs/` (architecture, design, operations, product, strategy, release, reference) into the standard set: `ARCHITECTURE.md`, `DESIGN.md`, `OPERATIONS.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `API-REFERENCE.md`, `DB-SCHEMA.md` (Prisma), `DEPENDENCIES.md`.

## Checklist
- [~] VERSION + package.json match — **done at `0.9.0`**. Alpha runway is now in place:
  `version:check` accepts `x.y.z-alpha.N` (and `-beta.N`/`-rc.N`) in both the
  package version and the release tag, and `ci.yml` publishes pre-release tags to the
  moving `:alpha` channel instead of `:latest`. The actual `1.0.0-alpha.1` version
  retarget + `v1.0.0-alpha.1` tag remains a **deliberate release step** (flip the three
  version fields, tag, push).
- [~] Trivy CRITICAL gate — **present in `ci.yml`** (HIGH,CRITICAL scan, CRITICAL blocks publish) and now **dedupes the tracking issue** (updates in place / closes when clean). A separate `release.yml` per the template was not split out; the existing `ci.yml` verify+publish already covers it.
- [x] dependabot.yml — present (npm + docker + github-actions, weekly); `vitest` +
  `@vitest/*` now grouped so peer-locked bumps land in one PR.
- [x] CHANGELOG.md top-level · LICENSE.md · CLAUDE.md pointer · **STYLING.md** — **done**.
- [x] README badges working · [ ] docs/ consolidated — badges **done**; `docs/`
  consolidation into the standard set still pending (33 files → 8; its own PR).

> **Alpha-prep audit (2026-07-05):** `STYLING.md`, the `version:check` pre-release
> relaxation, the `:alpha` publish channel, and the vitest dependabot grouping are
> **done**. Remaining for the Alpha rename: the `1.0.0-alpha.1` version retarget +
> `v1.0.0-alpha.1` tag (deliberate release step), the `docs/` consolidation
> (33 → 8 standard files), and trimming `AGENTS.md` to the standard sections. The
> migrator image is already built and pushed by `ci.yml`'s `publish` job.
