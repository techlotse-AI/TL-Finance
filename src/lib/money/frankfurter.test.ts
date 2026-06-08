import { describe, expect, it } from "vitest";

import { fetchFrankfurterRates } from "@/lib/money/frankfurter";

describe("fetchFrankfurterRates", () => {
  it("fetches deterministic reference rates without requesting the reporting currency", async () => {
    const requested: string[] = [];
    const rates = await fetchFrankfurterRates(["EUR", "CHF", "EUR", "USD"], "CHF", async (input) => {
      const url = input.toString();
      requested.push(url);
      const base = new URL(url).searchParams.get("base")!;
      return Response.json({
        date: "2026-06-05",
        base,
        rates: { CHF: base === "EUR" ? 0.95 : 0.8 },
      });
    });

    expect(requested).toHaveLength(2);
    expect(rates).toMatchObject([
      { fromCurrency: "EUR", toCurrency: "CHF", rate: "0.95000000" },
      { fromCurrency: "USD", toCurrency: "CHF", rate: "0.80000000" },
    ]);
  });

  it("fails as an upstream error when the provider response is malformed", async () => {
    await expect(fetchFrankfurterRates(["EUR"], "CHF", async () => Response.json({
      date: "not-a-date",
      base: "EUR",
      rates: {},
    }))).rejects.toMatchObject({
      status: 502,
      code: "exchange_rate_provider_invalid_response",
    });
  });
});
