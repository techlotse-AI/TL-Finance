import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const packageVersion = packageJson.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.[""]?.version;

if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error(`package.json version must be semantic x.y.z, received ${packageVersion}.`);
}

// The top-level VERSION file is the single source of truth (MIGRATION.md §2);
// package.json must match it.
const versionFile = (await readFile(new URL("../VERSION", import.meta.url), "utf8")).trim();
if (versionFile !== packageVersion) {
  throw new Error(`Version mismatch: VERSION=${versionFile}, package.json=${packageVersion}.`);
}

if (lockVersion !== packageVersion || lockRootVersion !== packageVersion) {
  throw new Error(
    `Version mismatch: package.json=${packageVersion}, package-lock.json=${lockVersion}, package-lock root=${lockRootVersion}.`,
  );
}

// The published release version is driven by the pushed git tag (vX.Y.Z), not by
// package.json — see .github/workflows/ci.yml. We therefore only assert that a
// release tag is well-formed semantic versioning, NOT that it equals
// package.json. This lets `git tag v0.8.2 && git push origin v0.8.2` publish
// 0.8.2 + latest without first bumping package.json. package.json/package-lock
// are still kept consistent with each other (above) for local development and
// Docker image metadata.
if (process.env.GITHUB_REF_TYPE === "tag") {
  const tag = process.env.GITHUB_REF_NAME ?? "";
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`Release tag ${tag} must be semantic v x.y.z (e.g. v0.8.2).`);
  }
  console.log(`Release tag ${tag} is well-formed; publishing ${tag.slice(1)} + latest.`);
}

console.log(`package.json/package-lock version ${packageVersion} is consistent.`);
