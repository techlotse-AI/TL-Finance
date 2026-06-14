import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const packageVersion = packageJson.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.[""]?.version;

if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error(`package.json version must be semantic x.y.z, received ${packageVersion}.`);
}

if (lockVersion !== packageVersion || lockRootVersion !== packageVersion) {
  throw new Error(
    `Version mismatch: package.json=${packageVersion}, package-lock.json=${lockVersion}, package-lock root=${lockRootVersion}.`,
  );
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${packageVersion}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    throw new Error(`Release tag ${process.env.GITHUB_REF_NAME} does not match ${expectedTag}.`);
  }
}

console.log(`Release version ${packageVersion} is consistent.`);
