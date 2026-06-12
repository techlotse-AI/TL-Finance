import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const apiRoot = join(import.meta.dirname, "..", "src", "app", "api");
const unsafeMethodPattern = /export async function (POST|PUT|PATCH|DELETE)\b/;
const trustedOriginPattern = /\b(readJson|assertTrustedOrigin|assertSchedulerAuthorization)\b/;
const violations = [];

async function inspect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(path);
      continue;
    }

    if (entry.name !== "route.ts") continue;
    const source = await readFile(path, "utf8");
    if (unsafeMethodPattern.test(source) && !trustedOriginPattern.test(source)) {
      violations.push(path);
    }
  }
}

await inspect(apiRoot);

if (violations.length > 0) {
  console.error("Unsafe API methods must enforce a trusted origin through readJson or assertTrustedOrigin:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("API trusted-origin check passed.");
}
