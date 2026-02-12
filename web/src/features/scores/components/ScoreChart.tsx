import { compactNumberFormatter } from "@/src/utils/numbers";
import { getColorsForCategories } from "@/src/features/dashboard/utils/getColorsForCategories";
import { isEmptyChart } from "@/src/features/dashboard/lib/score-analytics-utils";
import { NoDataOrLoading } from "@/src/components/NoDataOrLoading";
import { Card } from "@/src/components/ui/card";
import { type ChartBin } from "@/src/features/scores/types";
import { cn } from "@/src/utils/tailwind";
import { Tooltip, type CustomTooltipProps } from "@/src/features/dashboard/components/Tooltip";
import {
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function CategoricalChart(props: {
  chartData: ChartBin[];
  chartLabels: string[];
  isLoading?: boolean;
  stack?: boolean;
  showXAxis?: boolean;
  className?: string;
  chartClass?: string;
}) {
  const barCategoryGap = (chartLength: number): string => {
    if (chartLength > 7) return "10%";
    if (chartLength > 5) return "20%";
    if (chartLength > 3) return "30%";
    else return "40%";
  };
  const colors = getColorsForCategories(props.chartLabels);
  const intlFormatter = (value: number) => Intl.NumberFormat("en-US").format(value).toString();

  const renderTooltip = ({ active, payload, label }: any) => {
    const tooltipProps: CustomTooltipProps = { active, payload, label };
    return <Tooltip {...tooltipProps} formatter={intlFormatter} />;
  };

  return isEmptyChart({ data: props.chartData }) ? (
    <NoDataOrLoading isLoading={props.isLoading ?? false} className={props.chartClass} />
  ) : (
    <Card className={cn("max-h-full min-h-0 min-w-0 max-w-full flex-1 rounded-md border", props.className)}>
      <ResponsiveContainer
        width="100%"
        height={300}
        className={cn("max-h-full min-h-0 min-w-0 max-w-full", props.chartClass)}
      >
        <RechartsBarChart
          data={props.chartData}
          barCategoryGap={barCategoryGap(props.chartData.length)}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          {(props.showXAxis ?? true) && (
            <XAxis
              dataKey="binLabel"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
          )}
          <YAxis
            width={48}
            tickFormatter={intlFormatter}
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <RechartsTooltip content={renderTooltip} />
          <Legend />
          {props.chartLabels.map((label, i) => (
            <Bar
              key={label}
              dataKey={label}
              fill={colors[i]}
              stackId={props.stack ?? true ? "stack" : undefined}
              animationDuration={500}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function NumericChart(props: {
  chartData: ChartBin[];
  chartLabels: string[];
  index: string;
  maxFractionDigits?: number;
}) {
  const colors = getColorsForCategories(props.chartLabels);
  const formatter = (value: number) => compactNumberFormatter(value, props.maxFractionDigits);

  const renderTooltip = ({ active, payload, label }: any) => {
    const tooltipProps: CustomTooltipProps = { active, payload, label };
    return (
      <div className="max-w-56">
        <Tooltip {...tooltipProps} formatter={formatter} />
      </div>
    );
  };

  return isEmptyChart({ data: props.chartData }) ? (
    <NoDataOrLoading isLoading={false} />
  ) : (
    <Card className="max-h-full min-h-0 min-w-0 max-w-full flex-1 rounded-md border">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLineChart data={props.chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={props.index} hide />
          <YAxis
            width={48}
            tickFormatter={formatter}
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <RechartsTooltip content={renderTooltip} />
          <Legend />
          {props.chartLabels.map((label, i) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              stroke={colors[i]}
              dot={false}
              animationDuration={500}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </Card>
  );
}
