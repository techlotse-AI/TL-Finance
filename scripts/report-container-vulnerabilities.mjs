import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MAX_REPORT_LENGTH = 55_000;

function clean(value) {
  return String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ")
    .trim() || "—";
}

function vulnerabilityLink(vulnerability) {
  const id = clean(vulnerability.VulnerabilityID);
  const url = String(vulnerability.PrimaryURL ?? "").trim();
  return url ? `[${id}](${url})` : id;
}

export function collectVulnerabilities(report) {
  return (report.Results ?? [])
    .flatMap((result) =>
      (result.Vulnerabilities ?? []).map((vulnerability) => ({
        ...vulnerability,
        Target: result.Target,
      })),
    )
    .filter((vulnerability) => ["HIGH", "CRITICAL"].includes(vulnerability.Severity))
    .sort((left, right) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1 };
      return (
        severityOrder[left.Severity] - severityOrder[right.Severity] ||
        String(left.Target).localeCompare(String(right.Target)) ||
        String(left.PkgName).localeCompare(String(right.PkgName)) ||
        String(left.VulnerabilityID).localeCompare(String(right.VulnerabilityID))
      );
    });
}

export function buildIssueReports(vulnerabilities, context = {}) {
  const criticalCount = vulnerabilities.filter((item) => item.Severity === "CRITICAL").length;
  const highCount = vulnerabilities.filter((item) => item.Severity === "HIGH").length;
  const runLink = context.runUrl ? `[GitHub Actions run](${context.runUrl})` : "GitHub Actions run";
  const releaseTag = clean(context.releaseTag ?? "unknown release");
  const summary = [
    `Container scan for \`${releaseTag}\` found **${criticalCount} Critical** and **${highCount} High** vulnerabilities.`,
    "",
    `${runLink}. Publishing is blocked when Critical vulnerabilities are present.`,
    "",
  ].join("\n");
  const tableHeader = [
    "| Severity | Vulnerability | Target | Package | Installed | Fixed | Title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ].join("\n");
  const rows = vulnerabilities.map((item) =>
    [
      clean(item.Severity),
      vulnerabilityLink(item),
      clean(item.Target),
      clean(item.PkgName),
      clean(item.InstalledVersion),
      clean(item.FixedVersion),
      clean(item.Title),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
  );

  const reports = [];
  let report = `${summary}${tableHeader}\n`;
  for (const row of rows) {
    if (report.length + row.length + 1 > MAX_REPORT_LENGTH && report !== `${summary}${tableHeader}\n`) {
      reports.push(report);
      report = `Continuation of the complete vulnerability report for \`${releaseTag}\`.\n\n${tableHeader}\n`;
    }
    report += `${row}\n`;
  }
  reports.push(report);
  return reports;
}

export async function main(inputPath, outputDirectory) {
  if (!inputPath || !outputDirectory) {
    throw new Error("Usage: node scripts/report-container-vulnerabilities.mjs <trivy-json> <output-directory>");
  }

  const scan = JSON.parse(await readFile(inputPath, "utf8"));
  const vulnerabilities = collectVulnerabilities(scan);
  const criticalCount = vulnerabilities.filter((item) => item.Severity === "CRITICAL").length;
  const highCount = vulnerabilities.filter((item) => item.Severity === "HIGH").length;

  await mkdir(outputDirectory, { recursive: true });
  if (vulnerabilities.length > 0) {
    const reports = buildIssueReports(vulnerabilities, {
      releaseTag: process.env.RELEASE_TAG,
      runUrl: process.env.RELEASE_RUN_URL,
    });
    await Promise.all(
      reports.map((report, index) =>
        writeFile(`${outputDirectory}/part-${String(index + 1).padStart(3, "0")}.md`, report, "utf8"),
      ),
    );
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `critical_count=${criticalCount}\nhigh_count=${highCount}\ntotal_count=${vulnerabilities.length}\n`,
      "utf8",
    );
  }

  console.log(`Container scan findings: ${criticalCount} Critical, ${highCount} High.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2], process.argv[3]);
}
