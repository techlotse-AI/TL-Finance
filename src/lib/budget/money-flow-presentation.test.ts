import { describe, expect, it } from "vitest";

import {
  buildFlowColorMap,
  flowLinkDasharray,
  flowRouteColor,
  flowRouteDasharray,
  flowRouteKey,
  flowRouteLabel,
} from "@/lib/budget/money-flow-presentation";

describe("money-flow presentation", () => {
  it("keeps route-family colors distinct and source/category colors deterministic", () => {
    expect(flowRouteColor("income", "salary")).toBe(flowRouteColor("income", "salary"));
    expect(flowRouteColor("income", "salary")).not.toBe(flowRouteColor("expense", "salary"));
    expect(flowRouteColor("expense", "housing")).not.toBe(flowRouteColor("expense", "transport"));
  });

  it("assigns different visible colors to different source and category types", () => {
    const colors = buildFlowColorMap([
      { routeKind: "income", colorKey: "salary" },
      { routeKind: "income", colorKey: "dividend" },
      { routeKind: "expense", colorKey: "housing" },
      { routeKind: "expense", colorKey: "transport" },
    ]);

    expect(colors.get(flowRouteKey("income", "salary"))).not.toBe(colors.get(flowRouteKey("income", "dividend")));
    expect(colors.get(flowRouteKey("expense", "housing"))).not.toBe(colors.get(flowRouteKey("expense", "transport")));
  });

  it("uses a non-color cue for internal transfers", () => {
    expect(flowRouteLabel("transfer")).toBe("Internal transfer");
    expect(flowRouteDasharray("transfer")).toBeTruthy();
    expect(flowRouteDasharray("expense")).toBeUndefined();
  });

  it("gives provisions a dash distinct from transfers", () => {
    expect(flowLinkDasharray("expense", true)).toBeTruthy();
    expect(flowLinkDasharray("expense", true)).not.toBe(flowLinkDasharray("transfer"));
    expect(flowLinkDasharray("expense")).toBeUndefined();
    expect(flowLinkDasharray("expense", false)).toBeUndefined();
    // Transfers keep their dash regardless of the provision flag.
    expect(flowLinkDasharray("transfer")).toBe(flowRouteDasharray("transfer"));
  });
});
