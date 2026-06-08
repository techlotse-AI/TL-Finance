import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { currencySchema } from "@/lib/budget/schemas";
import { money } from "@/lib/money/decimal";

const responseSchema = z.object({
  date: z.string().date(),
  base: currencySchema,
  rates: z.record(currencySchema, z.number().positive()),
});

export interface ReferenceRate {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: Date;
  source: string;
  staleAfter: Date;
}

export async function fetchFrankfurterRates(
  fromCurrencies: string[],
  toCurrency: string,
  fetcher: typeof fetch = fetch,
): Promise<ReferenceRate[]> {
  const uniqueFromCurrencies = [...new Set(fromCurrencies)]
    .filter((currency) => currency !== toCurrency)
    .sort();

  return Promise.all(uniqueFromCurrencies.map(async (fromCurrency) => {
    const url = new URL("https://api.frankfurter.dev/v1/latest");
    url.searchParams.set("base", fromCurrency);
    url.searchParams.set("symbols", toCurrency);
    const response = await fetcher(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new ApiError(502, "exchange_rate_provider_failed", "The reference-rate provider could not complete the request.");
    }
    const raw = await response.json().catch(() => null);
    const result = responseSchema.safeParse(raw);
    if (!result.success) {
      throw new ApiError(502, "exchange_rate_provider_invalid_response", "The reference-rate provider returned an invalid response.");
    }
    const parsed = result.data;
    const rate = parsed.rates[toCurrency];
    if (!rate) throw new ApiError(502, "exchange_rate_missing", `The reference-rate provider did not return ${fromCurrency} to ${toCurrency}.`);
    const asOf = new Date(`${parsed.date}T16:00:00.000Z`);
    return {
      fromCurrency,
      toCurrency,
      rate: money(rate).toDecimalPlaces(8).toFixed(8),
      asOf,
      source: "Frankfurter institutional reference rates",
      staleAfter: new Date(asOf.getTime() + 48 * 60 * 60 * 1000),
    };
  }));
}
