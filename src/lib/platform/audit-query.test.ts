import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUDIT_PAGE_SIZE,
  buildAuditWhere,
  dayBound,
  paginationMeta,
  parseAuditQuery,
} from "@/lib/platform/audit-query";

describe("parseAuditQuery", () => {
  it("defaults page to 1 and size to the default when absent", () => {
    const query = parseAuditQuery({});
    expect(query.page).toBe(1);
    expect(query.size).toBe(DEFAULT_AUDIT_PAGE_SIZE);
    expect(query.action).toBeUndefined();
  });

  it("accepts only 10/20/50 page sizes and falls back otherwise", () => {
    expect(parseAuditQuery({ auditSize: "10" }).size).toBe(10);
    expect(parseAuditQuery({ auditSize: "50" }).size).toBe(50);
    expect(parseAuditQuery({ auditSize: "37" }).size).toBe(DEFAULT_AUDIT_PAGE_SIZE);
    expect(parseAuditQuery({ auditSize: "999" }).size).toBe(DEFAULT_AUDIT_PAGE_SIZE);
  });

  it("clamps page to >= 1 and trims filter strings", () => {
    expect(parseAuditQuery({ auditPage: "0" }).page).toBe(1);
    expect(parseAuditQuery({ auditPage: "-3" }).page).toBe(1);
    expect(parseAuditQuery({ auditPage: "4" }).page).toBe(4);
    expect(parseAuditQuery({ auditAction: "  auth.signin  " }).action).toBe("auth.signin");
    expect(parseAuditQuery({ auditAction: "   " }).action).toBeUndefined();
  });

  it("takes the first value when a param repeats", () => {
    expect(parseAuditQuery({ auditResource: ["User", "Session"] }).resourceType).toBe("User");
  });
});

describe("buildAuditWhere", () => {
  it("returns an empty object with no filters", () => {
    expect(buildAuditWhere({})).toEqual({});
  });

  it("includes action and resourceType equality", () => {
    expect(buildAuditWhere({ action: "auth.signin", resourceType: "Session" })).toEqual({
      action: "auth.signin",
      resourceType: "Session",
    });
  });

  it("builds a createdAt range from either or both bounds", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-06-30T23:59:59.999Z");
    expect(buildAuditWhere({ fromDate: from })).toEqual({ createdAt: { gte: from } });
    expect(buildAuditWhere({ toDate: to })).toEqual({ createdAt: { lte: to } });
    expect(buildAuditWhere({ fromDate: from, toDate: to })).toEqual({ createdAt: { gte: from, lte: to } });
  });
});

describe("dayBound", () => {
  it("returns inclusive start/end of a valid day", () => {
    expect(dayBound("2026-06-15", "start")?.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(dayBound("2026-06-15", "end")?.toISOString()).toBe("2026-06-15T23:59:59.999Z");
  });

  it("rejects malformed or empty days", () => {
    expect(dayBound(undefined, "start")).toBeUndefined();
    expect(dayBound("2026-6-1", "start")).toBeUndefined();
    expect(dayBound("not-a-date", "end")).toBeUndefined();
  });
});

describe("paginationMeta", () => {
  it("computes pages, skip, and bounds", () => {
    const meta = paginationMeta(45, 2, 20);
    expect(meta.totalPages).toBe(3);
    expect(meta.skip).toBe(20);
    expect(meta.hasPrev).toBe(true);
    expect(meta.hasNext).toBe(true);
  });

  it("clamps an out-of-range page into bounds", () => {
    const meta = paginationMeta(45, 99, 20);
    expect(meta.page).toBe(3);
    expect(meta.skip).toBe(40);
    expect(meta.hasNext).toBe(false);
  });

  it("always has at least one page even with zero rows", () => {
    const meta = paginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.skip).toBe(0);
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(false);
  });
});
