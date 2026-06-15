import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function composeConfig(args) {
  const result = spawnSync("docker", ["compose", ...args, "config", "--format", "json"], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Docker Compose validation failed:\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

const cloud = composeConfig([
  "--env-file",
  ".env.example",
  "--profile",
  "scheduled-backups",
]);
const development = composeConfig([
  "--env-file",
  ".env.development.example",
  "--profile",
  "scheduled-backups",
  "-f",
  "compose.yaml",
  "-f",
  "compose.dev.yaml",
]);
const cloudSource = readFileSync("compose.yaml", "utf8");

for (const [name, service] of Object.entries(cloud.services)) {
  assert(!service.build, `Cloud service ${name} must pull an image and must not define build.`);
}

assert(cloud.services.app.image === "techlotse/tl-finance:vX.Y.Z", "Cloud app image is not version-pinned.");
assert(
  cloud.services.migrate.image === "techlotse/tl-finance-migrator:vX.Y.Z",
  "Cloud migrator image is not version-pinned.",
);
assert(
  cloud.services["backup-scheduler"].image === cloud.services.app.image,
  "Backup scheduler must use the version-matched application image.",
);
assert(
  cloud.services["backup-scheduler"].healthcheck?.disable === true,
  "Backup scheduler must disable the application HTTP healthcheck.",
);
assert(!cloud.services.db.ports, "Cloud PostgreSQL must not publish a host port.");
assert(cloud.networks.database?.internal === true, "Cloud database network must be internal.");
assert(
  cloud.services.app.ports?.length === 1 && cloud.services.app.ports[0].host_ip === "127.0.0.1",
  "Cloud application must bind to loopback by default.",
);
assert(
  cloud.services.app.depends_on?.migrate?.condition === "service_completed_successfully",
  "Cloud application must wait for successful migrations.",
);
assert(
  cloud.services.migrate.depends_on?.db?.condition === "service_healthy",
  "Cloud migrator must wait for a healthy database.",
);
for (const name of ["app", "migrate", "backup-scheduler"]) {
  assert(cloud.services[name].read_only === true, `Cloud service ${name} must use a read-only root filesystem.`);
  assert(cloud.services[name].pull_policy === "always", `Cloud service ${name} must always pull its release image.`);
}
for (const name of [
  "DATABASE_URL",
  "AUDIT_IP_HASH_SECRET",
  "RATE_LIMIT_HASH_SECRET",
  "SCHEDULED_BACKUP_TOKEN",
  "POSTGRES_PASSWORD",
  "TL_FINANCE_VERSION",
]) {
  assert(cloudSource.includes(`\${${name}:?`), `Cloud Compose must require ${name}.`);
}

assert(development.services.app.build, "Development app service must build from source.");
assert(development.services.migrate.build?.target === "migrator", "Development migrator must build its target.");
assert(development.services.db.ports?.length === 1, "Development PostgreSQL must publish its local tooling port.");

console.log("Cloud and development Compose deployment contracts passed.");
