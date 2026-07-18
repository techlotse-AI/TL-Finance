import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const required = [
  "docs/operations/THREAT_MODEL.md",
  "docs/operations/INCIDENT_RESPONSE.md",
  "docs/operations/PRIVACY.md",
  "docs/operations/BACKUP_RESTORE.md",
  "docs/operations/SECRET_ROTATION.md",
  "docs/operations/PUBLIC_DEPLOYMENT_CHECKLIST.md",
  "src/app/api/auth/password-reset/request/route.ts",
  "src/app/api/auth/password-reset/complete/route.ts",
  "src/app/api/auth/verify-email/request/route.ts",
  "src/app/api/auth/verify-email/complete/route.ts",
  "src/app/api/auth/sessions/[id]/route.ts",
  "src/app/api/system/scheduled-backup/route.ts",
  "scripts/restore-platform-backup.mjs",
];
for (const path of required) await access(join(root, path));
const env = await readFile(join(root, ".env.example"), "utf8");
for (const name of ["RATE_LIMIT_HASH_SECRET", "EMAIL_VERIFICATION_REQUIRED", "SMTP_HOST", "SCHEDULED_BACKUP_TOKEN", "TOTP_ENCRYPTION_KEY"]) {
  if (!env.includes(`${name}=`)) throw new Error(`.env.example is missing ${name}.`);
}
console.log("v0.4 public-readiness artifact check passed.");
