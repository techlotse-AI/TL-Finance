"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DrawdownRateResult } from "@/lib/optimize/drawdown";
import type { WealthProjectionSeries } from "@/lib/optimize/wealth-projection";

// Wealth-planner charts (v0.9.1) — the first Recharts consumer in the app.
// Chart colors come from the validated --chart-* tokens in globals.css (see
// the palette note there); text always wears text tokens, never series color.
// Series identity never relies on color alone: every chart pairs its marks
// with a stacked legend block (sorted by final value, so labels cannot
// overlap) and the panel renders a tabular alternative beneath each chart.

const RATE_RAMP = [
  "var(--chart-rate-1)",
  "var(--chart-rate-2)",
  "var(--chart-rate-3)",
  "var(--chart-rate-4)",
  "var(--chart-rate-5)",
  "var(--chart-rate-6)",
];
const DEPLETE_RAMP = ["var(--chart-deplete-1)", "var(--chart-deplete-2)", "var(--chart-deplete-3)"];

/** Spread n series across the 6-step ordinal ramp: light = lowest rate. */
function rateColor(index: number, count: number): string {
  if (count <= 1) return RATE_RAMP[3];
  const position = Math.round((index * (RATE_RAMP.length - 1)) / (count - 1));
  return RATE_RAMP[position];
}

function compact(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CH", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

function percentLabel(rate: string): string {
  return `${(Number(rate) * 100).toFixed(Number(rate) * 100 % 1 === 0 ? 0 : 1)}%`;
}

const axisTick = { fill: "var(--subdued)", fontSize: 12 } as const;
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--foreground)",
  fontSize: 12,
} as const;

function ChartShell({
  label,
  empty,
  legend,
  children,
}: {
  label: string;
  empty: boolean;
  legend: ReactNode;
  children: ReactNode;
}) {
  if (empty) {
    return (
      <div className="grid min-h-48 place-items-center rounded border border-dashed bg-muted/20 p-8 text-center">
        <p className="text-sm text-subdued">No data yet — run the calculation to see this chart.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row" role="img" aria-label={label}>
      <div className="h-64 min-w-0 flex-1">{children}</div>
      {legend}
    </div>
  );
}

/**
 * Right-side stacked legend block: one entry per series, sorted by final
 * value, swatch + name + end value. This is the end-label channel — entries
 * stack in their own column, so labels can never collide the way per-line
 * inline labels do when series converge.
 */
function StackedLegend({
  entries,
}: {
  entries: Array<{ key: string; color: string; label: string; value: string; dashed?: boolean }>;
}) {
  return (
    <ul className="flex shrink-0 flex-col justify-center gap-2 text-xs sm:w-44" aria-hidden={false}>
      {entries.map((entry) => (
        <li className="flex items-center gap-2" key={entry.key}>
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 shrink-0 rounded"
            style={{
              background: entry.dashed
                ? `repeating-linear-gradient(90deg, ${entry.color} 0 3px, transparent 3px 6px)`
                : entry.color,
            }}
          />
          <span className="min-w-0">
            <span className="block truncate text-subdued">{entry.label}</span>
            <span className="block font-semibold tabular-nums text-foreground">{entry.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Wealth over time — one line per return rate (ordinal blue ramp). */
export function WealthProjectionChart({
  series,
  currency,
}: {
  series: WealthProjectionSeries[];
  currency: string;
}) {
  const rows = (series[0]?.points ?? []).map((point, index) => {
    const row: Record<string, number> = { age: point.age };
    for (const entry of series) {
      row[entry.annualReturnRate] = Number(entry.points[index]?.endingBalance ?? 0);
    }
    return row;
  });

  const legend = [...series]
    .map((entry, index) => ({
      key: entry.annualReturnRate,
      color: rateColor(index, series.length),
      label: `${percentLabel(entry.annualReturnRate)} real return`,
      value: compact(Number(entry.endingBalance), currency),
      numeric: Number(entry.endingBalance),
    }))
    .sort((a, b) => b.numeric - a.numeric);

  return (
    <ChartShell
      label={`Projected wealth by age at ${series.map((entry) => percentLabel(entry.annualReturnRate)).join(", ")} real returns`}
      empty={series.length === 0}
      legend={<StackedLegend entries={legend} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="age" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => compact(value, currency)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(age) => `Age ${age}`}
            formatter={(value, name) => [compact(Number(value), currency), `${percentLabel(String(name))} real return`]}
          />
          {series.map((entry, index) => (
            <Line
              key={entry.annualReturnRate}
              dataKey={entry.annualReturnRate}
              stroke={rateColor(index, series.length)}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Pay-ins vs internal growth — stacked areas with the growth-covers-pay-in marker. */
export function PayInsVsGrowthChart({
  series,
  currency,
}: {
  series: WealthProjectionSeries;
  currency: string;
}) {
  const rows = series.points.map((point) => ({
    age: point.age,
    payIns: Number(point.cumulativePayIns),
    growth: Math.max(0, Number(point.growth)),
  }));
  const marker = series.growthMatchesPayIn;

  const legend = [
    {
      key: "growth",
      color: "var(--chart-growth)",
      label: "Internal growth",
      value: compact(Number(series.totalGrowth), currency),
    },
    {
      key: "payIns",
      color: "var(--chart-payins)",
      label: "Cumulative pay-ins",
      value: compact(Number(series.totalPayIns), currency),
    },
  ];

  return (
    <div className="space-y-2">
      <ChartShell
        label={`Cumulative pay-ins versus internal growth by age at ${percentLabel(series.annualReturnRate)} real return`}
        empty={rows.length === 0}
        legend={<StackedLegend entries={legend} />}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
            <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tickCount={8} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => compact(value, currency)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(age) => `Age ${age}`}
              formatter={(value, name) => [
                compact(Number(value), currency),
                name === "payIns" ? "Cumulative pay-ins" : "Internal growth",
              ]}
            />
            <Area
              dataKey="payIns"
              stackId="wealth"
              stroke="var(--chart-payins)"
              strokeWidth={2}
              fill="var(--chart-payins)"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Area
              dataKey="growth"
              stackId="wealth"
              stroke="var(--chart-growth)"
              strokeWidth={2}
              fill="var(--chart-growth)"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            {marker ? (
              <ReferenceLine
                x={marker.age}
                stroke="var(--subdued)"
                strokeWidth={1}
                label={{
                  value: `growth ≥ pay-in`,
                  position: "insideTopLeft",
                  fill: "var(--subdued)",
                  fontSize: 11,
                }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>
      {marker ? (
        <p className="text-xs text-subdued">
          From age {marker.age.toFixed(1)} the portfolio&apos;s own monthly growth covers the recurring
          contribution (balance {compact(Number(marker.balance), currency)}).
        </p>
      ) : (
        <p className="text-xs text-subdued">
          Within this horizon the portfolio&apos;s monthly growth never reaches the recurring contribution.
        </p>
      )}
    </div>
  );
}

/** Lever comparison — baseline vs lever scenarios at one rate. */
export function LeverComparisonChart({
  series,
  currency,
}: {
  series: WealthProjectionSeries[];
  currency: string;
}) {
  const rows = (series[0]?.points ?? []).map((point, index) => {
    const row: Record<string, number> = { age: point.age };
    for (const entry of series) {
      row[entry.name] = Number(entry.points[index]?.endingBalance ?? 0);
    }
    return row;
  });

  const legend = [...series]
    .map((entry, index) => ({
      key: entry.name,
      color: rateColor(index, series.length),
      label:
        entry.deltaVsBaselineAtHorizon === null
          ? entry.name
          : `${entry.name} (${Number(entry.deltaVsBaselineAtHorizon) >= 0 ? "+" : ""}${compact(Number(entry.deltaVsBaselineAtHorizon), currency)})`,
      value: compact(Number(entry.endingBalance), currency),
      numeric: Number(entry.endingBalance),
    }))
    .sort((a, b) => b.numeric - a.numeric);

  return (
    <ChartShell
      label={`Lever comparison at ${percentLabel(series[0]?.annualReturnRate ?? "0")} real return with the delta at the horizon`}
      empty={series.length === 0}
      legend={<StackedLegend entries={legend} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="age" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => compact(value, currency)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(age) => `Age ${age}`}
            formatter={(value, name) => [compact(Number(value), currency), String(name)]}
          />
          {series.map((entry, index) => (
            <Line
              key={entry.name}
              dataKey={entry.name}
              stroke={rateColor(index, series.length)}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function drawdownColor(mode: string, depleteRank: number): string {
  if (mode === "endowment") return "var(--chart-endowment)";
  if (mode === "fixed_expense") return "var(--chart-fixed-expense)";
  return DEPLETE_RAMP[Math.min(depleteRank, DEPLETE_RAMP.length - 1)];
}

/** Drawdown value curves per mode from retirement age. */
export function DrawdownChart({
  rate,
  currency,
}: {
  rate: DrawdownRateResult;
  currency: string;
}) {
  // Merge per-curve yearly points onto one age axis.
  const ages = new Map<number, Record<string, number>>();
  for (const curve of rate.curves) {
    for (const point of curve.points) {
      const row = ages.get(point.age) ?? { age: point.age };
      row[curve.mode] = Number(point.balance);
      ages.set(point.age, row);
    }
  }
  const rows = [...ages.values()].sort((a, b) => a.age - b.age);

  let depleteRank = 0;
  const curveColor = new Map<string, string>();
  for (const curve of rate.curves) {
    curveColor.set(curve.mode, drawdownColor(curve.mode, curve.mode.startsWith("deplete_") ? depleteRank++ : 0));
  }

  const legend = rate.curves.map((curve) => ({
    key: curve.mode,
    color: curveColor.get(curve.mode)!,
    label: curve.label,
    value: `${compact(Number(curve.monthlyDraw), currency)}/mo`,
    dashed: curve.mode === "fixed_expense",
  }));

  return (
    <ChartShell
      label={`Portfolio value from age ${rows[0]?.age ?? 0} for each drawdown mode at ${percentLabel(rate.annualReturnRate)} real return`}
      empty={rate.curves.length === 0}
      legend={<StackedLegend entries={legend} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tickCount={8} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => compact(value, currency)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(age) => `Age ${age}`}
            formatter={(value, name) => [
              compact(Number(value), currency),
              rate.curves.find((curve) => curve.mode === name)?.label ?? String(name),
            ]}
          />
          {rate.curves.map((curve) => (
            <Line
              key={curve.mode}
              dataKey={curve.mode}
              stroke={curveColor.get(curve.mode)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={curve.mode === "fixed_expense" ? "6 4" : undefined}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
