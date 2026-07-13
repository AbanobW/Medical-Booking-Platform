"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEGP, formatEGPCompact, formatNumber } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { CategoryCount, TimeSeriesPoint } from "@/lib/types";

/**
 * Chart system.
 *
 * Rules enforced here (see `globals.css` for the validated ramp):
 *  - One y-axis. Never two scales on one chart.
 *  - Categorical colors assigned in fixed order, never cycled or rank-based.
 *  - A legend is always present for ≥2 series; identity is never color-alone.
 *  - Recessive grid/axes; thin marks; crosshair + tooltip on every plot.
 */

/** Fixed categorical order — index N always maps to the same hue. */
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const AXIS_PROPS = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  vertical: false,
} as const;

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Shared tooltip surface — a 2px ring lifts it off the plot. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-popover-foreground shadow-lift ring-2 ring-background">
      {label !== undefined && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {formatter && typeof entry.value === "number"
                ? formatter(entry.value, String(entry.dataKey ?? ""))
                : formatNumber(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LEGEND_PROPS = {
  iconType: "circle",
  iconSize: 8,
  wrapperStyle: { fontSize: 12, paddingTop: 12 },
} as const;

function ChartFrame({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pl-0">{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Revenue — area, single series (no legend needed: the title names it)
// ---------------------------------------------------------------------------

export function RevenueChart({
  data,
  title = "Revenue",
  description = "Realised revenue from completed bookings, last 12 months",
  className,
}: {
  data: TimeSeriesPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <ChartFrame title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={64} tickFormatter={(v) => formatEGPCompact(Number(v))} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            content={<ChartTooltip formatter={(v) => formatEGP(v)} />}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Bookings vs cancellations — two series, legend required
// ---------------------------------------------------------------------------

export function BookingsChart({
  data,
  title = "Bookings",
  description = "Completed and confirmed bookings against cancellations",
  className,
}: {
  data: TimeSeriesPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <ChartFrame title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={40} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<ChartTooltip />}
          />
          <Legend {...LEGEND_PROPS} />

          <Bar
            dataKey="bookings"
            name="Bookings"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="cancellations"
            name="Cancellations"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Booking trend over time — single line series. */
export function TrendChart({
  data,
  title = "Booking trends",
  description = "Monthly booking volume across the platform",
  className,
}: {
  data: TimeSeriesPoint[];
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <ChartFrame title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={40} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            content={<ChartTooltip />}
          />

          <Line
            type="monotone"
            dataKey="bookings"
            name="Bookings"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Category rankings — horizontal bars, direct-labeled
// ---------------------------------------------------------------------------

export function CategoryBarChart({
  data,
  title,
  description,
  /** Formats the value in the tooltip and the direct label. */
  format = (v: number) => formatNumber(v),
  colorIndex = 0,
  className,
}: {
  data: CategoryCount[];
  title: string;
  description?: string;
  format?: (value: number) => string;
  colorIndex?: number;
  className?: string;
}) {
  const color = SERIES[colorIndex % SERIES.length];

  return (
    <ChartFrame title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 38)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={false}
          />
          <XAxis type="number" {...AXIS_PROPS} hide />
          <YAxis
            type="category"
            dataKey="name"
            {...AXIS_PROPS}
            width={140}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<ChartTooltip formatter={(v) => format(v)} />}
          />

          <Bar
            dataKey="value"
            name={title}
            fill={color}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            // Direct labels — required, since the light surface pushes several
            // ramp steps under 3:1 contrast.
            label={{
              position: "right",
              formatter: (value: unknown) => format(Number(value ?? 0)),
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Composition — donut, legend + direct percentage labels
// ---------------------------------------------------------------------------

export function DonutChart({
  data,
  title,
  description,
  format = (v: number) => formatNumber(v),
  className,
}: {
  data: CategoryCount[];
  title: string;
  description?: string;
  format?: (value: number) => string;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartFrame title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Tooltip
            content={
              <ChartTooltip
                formatter={(v) =>
                  `${format(v)} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`
                }
              />
            }
          />
          <Legend {...LEGEND_PROPS} />

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={96}
            // A 2px surface gap between segments, per the mark spec.
            paddingAngle={2}
            stroke="var(--background)"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** A sparkline for stat tiles — no axes, no legend, just the shape. */
export function Sparkline({
  data,
  dataKey = "bookings",
  colorIndex = 0,
  height = 44,
}: {
  data: TimeSeriesPoint[];
  dataKey?: keyof TimeSeriesPoint;
  colorIndex?: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={SERIES[colorIndex % SERIES.length]}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
