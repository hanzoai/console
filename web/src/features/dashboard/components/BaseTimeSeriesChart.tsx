import { getColorsForCategories } from "@/src/features/dashboard/utils/getColorsForCategories";
import { compactNumberFormatter } from "@/src/utils/numbers";
import { cn } from "@/src/utils/tailwind";
import {
  AreaChart as RechartsAreaChart,
  LineChart as RechartsLineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tooltip, type CustomTooltipProps } from "@/src/features/dashboard/components/Tooltip";
import {
  dashboardDateRangeAggregationSettings,
  type DashboardDateRangeAggregationOption,
} from "@/src/utils/date-range-utils";
import { useMemo } from "react";

export type TimeSeriesChartDataPoint = {
  ts: number;
  values: { label: string; value?: number }[];
};

export function BaseTimeSeriesChart(props: {
  className?: string;
  agg: DashboardDateRangeAggregationOption;
  data: TimeSeriesChartDataPoint[];
  showLegend?: boolean;
  connectNulls?: boolean;
  valueFormatter?: (value: number) => string;
  chartType?: "line" | "area";
}) {
  const labels = Array.from(new Set(props.data.flatMap((d) => d.values.map((v) => v.label))));

  type ChartInput = { timestamp: string } & {
    [key: string]: number | undefined;
  };

  function transformArray(array: TimeSeriesChartDataPoint[]): ChartInput[] {
    return array.map((item) => {
      const outputObject: ChartInput = {
        timestamp: convertDate(item.ts, props.agg),
      } as ChartInput;

      item.values.forEach((valueObject) => {
        outputObject[valueObject.label] = valueObject.value;
      });

      return outputObject;
    });
  }

  const convertDate = (date: number, agg: DashboardDateRangeAggregationOption) => {
    const showMinutes = ["minute", "hour"].includes(dashboardDateRangeAggregationSettings[agg].dateTrunc ?? "");

    if (showMinutes) {
      return new Date(date).toLocaleTimeString("en-US", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return new Date(date).toLocaleDateString("en-US", {
      year: "2-digit",
      month: "numeric",
      day: "numeric",
    });
  };

  const colors = getColorsForCategories(labels);
  const formatter = props.valueFormatter ?? compactNumberFormatter;

  const dynamicMaxValue = useMemo(() => {
    if (props.data.length === 0) return undefined;

    const maxValue = Math.max(...props.data.flatMap((point) => point.values.map((v) => v.value ?? 0)));

    if (maxValue <= 0) return undefined;

    const bufferedValue = maxValue * 1.1;
    const magnitude = Math.floor(Math.log10(bufferedValue));
    const roundTo = Math.max(1, Math.pow(10, magnitude) / 5);

    return Math.ceil(bufferedValue / roundTo) * roundTo;
  }, [props.data]);

  const chartData = transformArray(props.data);
  const isArea = props.chartType === "area";

  const renderTooltip = ({ active, payload, label }: any) => {
    const tooltipProps: CustomTooltipProps = { active, payload, label };
    return <Tooltip {...tooltipProps} formatter={formatter} />;
  };

  const ChartWrapper = isArea ? RechartsAreaChart : RechartsLineChart;

  return (
    <div className={cn("mt-4", props.className)}>
      <ResponsiveContainer width="100%" height={300}>
        <ChartWrapper data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <YAxis
            width={48}
            tickFormatter={(v) => formatter(v)}
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            domain={dynamicMaxValue ? [0, dynamicMaxValue] : undefined}
          />
          <RechartsTooltip content={renderTooltip} />
          {props.showLegend && <Legend />}
          {labels.map((label, i) =>
            isArea ? (
              <Area
                key={label}
                type="monotone"
                dataKey={label}
                stroke={colors[i]}
                fill={colors[i]}
                fillOpacity={0.1}
                connectNulls={props.connectNulls}
                animationDuration={500}
              />
            ) : (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={colors[i]}
                connectNulls={props.connectNulls}
                dot={false}
                animationDuration={500}
              />
            ),
          )}
        </ChartWrapper>
      </ResponsiveContainer>
    </div>
  );
}
