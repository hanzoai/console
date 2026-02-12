import { api } from "@/src/utils/api";
import { type ScoreSourceType, type FilterState, type ScoreDataTypeType } from "@hanzo/shared";
import { createTracesTimeFilter } from "@/src/features/dashboard/lib/dashboard-utils";
import React from "react";
import { Card } from "@/src/components/ui/card";
import { getColorsForCategories } from "@/src/features/dashboard/utils/getColorsForCategories";
import { padChartData } from "@/src/features/dashboard/lib/score-analytics-utils";
import { NoDataOrLoading } from "@/src/components/NoDataOrLoading";
import { Tooltip, type CustomTooltipProps } from "@/src/features/dashboard/components/Tooltip";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

export function NumericScoreHistogram(props: {
  projectId: string;
  name: string;
  source: ScoreSourceType;
  dataType: Extract<ScoreDataTypeType, "NUMERIC" | "BOOLEAN">;
  globalFilterState: FilterState;
}) {
  const histogram = api.dashboard.scoreHistogram.useQuery(
    {
      projectId: props.projectId,
      from: "traces_scores",
      select: [{ column: "value" }],
      filter: [
        ...createTracesTimeFilter(props.globalFilterState, "scoreTimestamp"),
        {
          type: "string",
          column: "scoreName",
          value: props.name,
          operator: "=",
        },
        {
          type: "string",
          column: "scoreSource",
          value: props.source,
          operator: "=",
        },
        {
          type: "string",
          column: "scoreDataType",
          value: props.dataType,
          operator: "=",
        },
      ],
      limit: 10000,
    },
    {
      trpc: {
        context: {
          skipBatch: true,
        },
      },
    },
  );

  const { chartData, chartLabels } = histogram.data ? histogram.data : { chartData: [], chartLabels: [] };

  const colors = getColorsForCategories(chartLabels);
  const paddedChartData = padChartData(chartData);
  const intlFormatter = (value: number) => Intl.NumberFormat("en-US").format(value).toString();

  const renderTooltip = ({ active, payload, label }: any) => {
    const tooltipProps: CustomTooltipProps = { active, payload, label };
    return <Tooltip {...tooltipProps} formatter={intlFormatter} />;
  };

  return histogram.isLoading || !Boolean(chartData.length) ? (
    <NoDataOrLoading isLoading={histogram.isLoading} />
  ) : (
    <Card className="min-h-[9rem] w-full flex-1 rounded-md border">
      <ResponsiveContainer width="100%" height={300} className="mt-4">
        <RechartsBarChart data={paddedChartData} barCategoryGap="0%">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="binLabel"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <YAxis
            width={48}
            tickFormatter={intlFormatter}
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <RechartsTooltip content={renderTooltip} />
          {chartLabels.map((label, i) => (
            <Bar
              key={label}
              dataKey={label}
              fill={colors[i]}
              animationDuration={500}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </Card>
  );
}
