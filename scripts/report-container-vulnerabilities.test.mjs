import { describe, expect, it } from "vitest";

import { buildIssueReports, collectVulnerabilities } from "./report-container-vulnerabilities.mjs";

describe("container vulnerability report", () => {
  it("includes and orders every High and Critical finding", () => {
    const findings = collectVulnerabilities({
      Results: [
        {
          Target: "application",
          Vulnerabilities: [
            { VulnerabilityID: "CVE-HIGH", PkgName: "zeta", Severity: "HIGH", Title: "High issue" },
            { VulnerabilityID: "CVE-LOW", PkgName: "ignored", Severity: "LOW", Title: "Low issue" },
            { VulnerabilityID: "CVE-CRITICAL", PkgName: "alpha", Severity: "CRITICAL", Title: "Critical issue" },
          ],
        },
      ],
    });

    expect(findings.map((item) => item.VulnerabilityID)).toEqual(["CVE-CRITICAL", "CVE-HIGH"]);

    const reports = buildIssueReports(findings, { releaseTag: "v0.5.0", runUrl: "https://example.test/run" });
    expect(reports.join("\n")).toContain("CVE-CRITICAL");
    expect(reports.join("\n")).toContain("CVE-HIGH");
    expect(reports.join("\n")).not.toContain("CVE-LOW");
    expect(reports.join("\n")).toContain("1 Critical");
    expect(reports.join("\n")).toContain("1 High");
  });
});
