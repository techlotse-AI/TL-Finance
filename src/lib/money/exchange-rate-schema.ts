import { z } from "zod";

import { currencySchema } from "@/lib/budget/schemas";
import { money } from "@/lib/money/decimal";

export const exchangeRateSchema = z.object({
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  rate: z.string().refine((value) => {
    try { return money(value).greaterThan(0); } catch { return false; }
  }, "Rate must be a positive decimal."),
  asOf: z.coerce.date(),
  source: z.string().trim().min(1).max(120),
  staleAfter: z.coerce.date(),
}).refine((value) => value.fromCurrency !== value.toCurrency, {
  message: "Exchange-rate currencies must differ.", path: ["toCurrency"],
});
