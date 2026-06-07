import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationsRoot = join(import.meta.dirname, "..", "prisma", "migrations");
const destructivePattern = /\b(DROP\s+(TABLE|COLUMN|TYPE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i;
const entries = await readdir(migrationsRoot, { withFileTypes: true });
const violations = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const migrationPath = join(migrationsRoot, entry.name, "migration.sql");
  const sql = await readFile(migrationPath, "utf8");

  if (destructivePattern.test(sql)) {
    violations.push(migrationPath);
  }
}

if (violations.length > 0) {
  console.error("Destructive migration statements require an explicitly reviewed migration plan:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Migration safety check passed.");
}
