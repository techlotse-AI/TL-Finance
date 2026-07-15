import { describe, expect, it } from "vitest";

import { categoryPresets } from "@/lib/country-profiles/presets";

describe("category presets", () => {
  it("includes the locked Swiss concepts", () => {
    const names = categoryPresets.swiss.flatMap((group) =>
      group.categories.map((category) => category.name),
    );

    expect(names).toEqual(
      expect.arrayContaining([
        "Pillar 3a",
        "Quellensteuer",
        "Nebenkosten",
        "Serafe",
        "Health insurance",
        "Swiss public transport",
      ]),
    );
  });

  it("includes South African household concepts (v0.9.5 groundwork)", () => {
    const names = categoryPresets.za.flatMap((group) =>
      group.categories.map((category) => category.name),
    );

    expect(names).toEqual(
      expect.arrayContaining([
        "Medical aid",
        "UIF",
        "Retirement annuity",
        "Tax-free savings account",
      ]),
    );
  });

  it("every preset carries the generic base categories", () => {
    for (const key of Object.keys(categoryPresets) as Array<keyof typeof categoryPresets>) {
      const names = categoryPresets[key].flatMap((group) => group.categories.map((category) => category.name));
      expect(names).toContain("Employment income");
    }
  });
});
