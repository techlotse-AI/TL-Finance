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
});
