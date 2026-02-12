import {
  BaseTimeSeriesChart,
  type TimeSeriesChartDataPoint,
} from "@/src/features/dashboard/components/BaseTimeSeriesChart";
import { TotalMetric } from "@/src/features/dashboard/components/TotalMetric";
import { type DashboardDateRangeAggregationOption } from "@/src/utils/date-range-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import { type ReactNode, useState } from "react";

export type BaseTabTimeseriesChartProps = {
  agg: DashboardDateRangeAggregationOption;
  showLegend?: boolean;
  connectNulls?: boolean;
  data: {
    totalMetric: ReactNode;
    metricDescription: ReactNode;
    tabTitle: string;
    formatter?: (value: number) => string;
    data: TimeSeriesChartDataPoint[];
  }[];
};

export const BaseTabTimeseriesChart = (props: BaseTabTimeseriesChartProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="flex flex-col justify-between">
      <TotalMetric
        metric={props.data[selectedIndex]?.totalMetric}
        description={props.data[selectedIndex]?.metricDescription}
      />
      <Tabs
        className="mt-4"
        value={String(selectedIndex)}
        onValueChange={(v) => setSelectedIndex(Number(v))}
        defaultValue="0"
      >
        <TabsList className="h-8">
          {props.data.map((data, index) => (
            <TabsTrigger value={String(index)} key={index}>
              {data.tabTitle}
            </TabsTrigger>
          ))}
        </TabsList>
        {props.data.map((data, index) => (
          <TabsContent value={String(index)} key={index}>
            <BaseTimeSeriesChart agg={props.agg} data={data.data} showLegend={true} valueFormatter={data.formatter} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
