import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export type MoneyInput = Decimal.Value;

export function money(value: MoneyInput): Decimal {
  const parsed = new Decimal(value);

  if (!parsed.isFinite()) {
    throw new Error("Money value must be finite.");
  }

  return parsed;
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(money(value)), new Decimal(0));
}

export function serializeMoney(value: MoneyInput): string {
  return money(value).toDecimalPlaces(4).toFixed(4);
}

export function serializeRate(value: MoneyInput): string {
  return money(value).toDecimalPlaces(6).toFixed(6);
}

export function formatMoney(value: MoneyInput, currency: string): string {
  return new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money(value).toNumber());
}
