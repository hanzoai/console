import { Download, Eye, Code } from "@/src/features/agents/components/ui/icon-bridge";
import { useState } from "react";
import type { WorkflowExecution } from "../../types/executions";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CopyButton } from "../ui/copy-button";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../ui/segmented-control";
import { JsonViewer } from "./JsonViewer";
import { EnhancedJsonViewer } from "../reasoners/EnhancedJsonViewer";

interface InputDataPanelProps {
  execution: WorkflowExecution;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

const DATA_VIEW_OPTIONS: ReadonlyArray<SegmentedControlOption> = [
  { value: "formatted", label: "Formatted", icon: Eye },
  { value: "json", label: "JSON", icon: Code },
] as const;

export function InputDataPanel({ execution }: InputDataPanelProps) {
  const [viewMode, setViewMode] = useState<"formatted" | "json">("formatted");
  const jsonString = JSON.stringify(execution.input_data, null, 2);

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <CardTitle className="text-base font-medium">Input Data</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <SegmentedControl
              value={viewMode}
              onValueChange={(mode) => setViewMode(mode as "formatted" | "json")}
              options={DATA_VIEW_OPTIONS}
              size="sm"
              optionClassName="min-w-[110px]"
            />
            <Badge variant="secondary" className="text-xs font-mono">
              {formatBytes(execution.input_size)}
            </Badge>
            <CopyButton
              value={jsonString}
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-muted/80 [&_svg]:h-3 [&_svg]:w-3"
              tooltip="Copy input JSON"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="border border-border rounded-md">
          {viewMode === "formatted" ? (
            <EnhancedJsonViewer
              data={execution.input_data}
              className="max-h-96 overflow-auto p-3"
              maxInlineHeight={300}
            />
          ) : (
            <JsonViewer
              data={execution.input_data}
              collapsed={2}
              className="max-h-96 overflow-auto p-3"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
