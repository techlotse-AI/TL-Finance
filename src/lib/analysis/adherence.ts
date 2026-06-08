import { money, serializeMoney } from "@/lib/money/decimal";

export type AdherenceStatus = "under" | "on" | "over" | "no_plan";

export interface PlannedCategoryInput {
  categoryId: string;
  categoryName: string;
  kind: string;
  currency: string;
  monthlyPlanned: string;
  essential: boolean;
}

export interface ActualCategoryInput {
  categoryId: string;
  currency: string;
  /** Signed allocation amount; spending is negative. */
  amount: string;
}

export interface AdherenceRow {
  categoryId: string;
  categoryName: string;
  kind: string;
  currency: string;
  essential: boolean;
  planned: string;
  actual: string;
  variance: string;
  usedPercent: number | null;
  status: AdherenceStatus;
}

export interface CurrencyTotal {
  currency: string;
  planned: string;
  actual: string;
}

interface Bucket {
  categoryId: string;
  categoryName: string;
  kind: string;
  currency: string;
  essential: boolean;
  planned: ReturnType<typeof money>;
  actual: ReturnType<typeof money>;
}

function key(categoryId: string, currency: string): string {
  return `${categoryId}${currency}`;
}

/**
 * Computes planned-versus-actual adherence per (category, currency). Planned is
 * the recurrence-normalized monthly baseline; actual is the magnitude of
 * allocated activity for the period. Comparison stays within a single currency
 * so no exchange-rate conversion is required.
 */
export function computeAdherence(
  planned: PlannedCategoryInput[],
  actual: ActualCategoryInput[],
): { rows: AdherenceRow[]; totals: CurrencyTotal[] } {
  const buckets = new Map<string, Bucket>();

  const ensure = (categoryId: string, currency: string, seed: Partial<Bucket> = {}): Bucket => {
    const id = key(categoryId, currency);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = {
        categoryId,
        categoryName: seed.categoryName ?? categoryId,
        kind: seed.kind ?? "EXPENSE",
        currency,
        essential: seed.essential ?? false,
        planned: money(0),
        actual: money(0),
      };
      buckets.set(id, bucket);
    }
    return bucket;
  };

  for (const item of planned) {
    const bucket = ensure(item.categoryId, item.currency, item);
    bucket.categoryName = item.categoryName;
    bucket.kind = item.kind;
    bucket.essential = item.essential;
    bucket.planned = bucket.planned.plus(money(item.monthlyPlanned));
  }

  for (const item of actual) {
    const bucket = ensure(item.categoryId, item.currency);
    bucket.actual = bucket.actual.plus(money(item.amount).abs());
  }

  const rows: AdherenceRow[] = [...buckets.values()].map((bucket) => {
    const planned = bucket.planned;
    const actual = bucket.actual;
    const usedPercent = planned.isZero() ? null : Number(actual.dividedBy(planned).times(100).toFixed(1));
    let status: AdherenceStatus;
    if (planned.isZero()) status = "no_plan";
    else if (actual.greaterThan(planned.times(1.05))) status = "over";
    else if (actual.lessThan(planned.times(0.95))) status = "under";
    else status = "on";

    return {
      categoryId: bucket.categoryId,
      categoryName: bucket.categoryName,
      kind: bucket.kind,
      currency: bucket.currency,
      essential: bucket.essential,
      planned: serializeMoney(planned),
      actual: serializeMoney(actual),
      variance: serializeMoney(planned.minus(actual)),
      usedPercent,
      status,
    };
  });

  rows.sort((left, right) => {
    const order: Record<AdherenceStatus, number> = { over: 0, no_plan: 1, on: 2, under: 3 };
    if (order[left.status] !== order[right.status]) return order[left.status] - order[right.status];
    return Number(right.actual) - Number(left.actual);
  });

  const totalsMap = new Map<string, { planned: ReturnType<typeof money>; actual: ReturnType<typeof money> }>();
  for (const bucket of buckets.values()) {
    const entry = totalsMap.get(bucket.currency) ?? { planned: money(0), actual: money(0) };
    entry.planned = entry.planned.plus(bucket.planned);
    entry.actual = entry.actual.plus(bucket.actual);
    totalsMap.set(bucket.currency, entry);
  }
  const totals: CurrencyTotal[] = [...totalsMap.entries()].map(([currency, value]) => ({
    currency,
    planned: serializeMoney(value.planned),
    actual: serializeMoney(value.actual),
  }));

  return { rows, totals };
}
