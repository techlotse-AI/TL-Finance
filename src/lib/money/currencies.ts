export const supportedCurrencies = ["EUR", "CHF", "ZAR", "USD", "GBP"] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];
