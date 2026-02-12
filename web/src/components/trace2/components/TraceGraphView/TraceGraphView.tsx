/**
 * TraceGraphView wrapper for trace2
 *
 * This component wraps the TraceGraphView from features/trace-graph-view/
 * and uses data from GraphDataContext.
 * Dynamically imported to avoid loading vis-network (45MB) unless needed.
 */

import dynamic from "next/dynamic";
import { useTraceGraphData } from "../../contexts/TraceGraphDataContext";

const TraceGraphViewComponent = dynamic(
  () =>
    import(
      "@/src/features/trace-graph-view/components/TraceGraphView"
    ).then((mod) => mod.TraceGraphView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading graph...</span>
      </div>
    ),
  },
);

export function TraceGraphView() {
  const { agentGraphData, isLoading } = useTraceGraphData();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading graph...</span>
      </div>
    );
  }

  if (agentGraphData.length === 0) {
    return null;
  }

  return <TraceGraphViewComponent agentGraphData={agentGraphData} />;
}
