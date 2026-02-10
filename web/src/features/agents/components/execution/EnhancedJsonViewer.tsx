import React, { useState } from "react";
import { Maximize2, Minimize2 } from "@/src/features/agents/components/ui/icon-bridge";
import { CopyButton } from "../ui/copy-button";
import { cn } from "../../lib/utils";

interface EnhancedJsonViewerProps {
  data: any;
  title?: string;
  className?: string;
  maxHeight?: string;
  collapsible?: boolean;
  showCopyButton?: boolean;
}

function JsonFormatter({ data }: { data: any }) {
  const formatValue = (value: any, depth: number = 0): React.ReactNode => {
    if (value === null) {
      return <span className="text-slate-500">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-blue-600">{String(value)}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-purple-600">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-green-600">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">[]</span>;
      }

      return (
        <>
          <span className="text-muted-foreground">[</span>
          <div className="ml-4">
            {value.map((item, index) => (
              <div key={index}>
                {formatValue(item, depth + 1)}
                {index < value.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
          </div>
          <span className="text-muted-foreground">]</span>
        </>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="text-muted-foreground">{"{}"}</span>;
      }

      return (
        <>
          <span className="text-muted-foreground">{"{"}</span>
          <div className="ml-4">
            {keys.map((key, index) => (
              <div key={key}>
                <span className="text-blue-500">"{key}"</span>
                <span className="text-muted-foreground">: </span>
                {formatValue(value[key], depth + 1)}
                {index < keys.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
          </div>
          <span className="text-muted-foreground">{"}"}</span>
        </>
      );
    }

    return <span className="text-foreground">{String(value)}</span>;
  };

  return (
    <pre className="text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap">
      {formatValue(data)}
    </pre>
  );
}

export function EnhancedJsonViewer({
  data,
  title,
  className,
  maxHeight = "400px",
  collapsible = true,
  showCopyButton = true
}: EnhancedJsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const isEmpty = !data || (typeof data === "object" && Object.keys(data).length === 0);

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      {(title || showCopyButton) && (
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          {title && (
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
          )}
          <div className="flex items-center gap-2">
            {showCopyButton && !isEmpty && (
              <CopyButton
                value={jsonString}
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-muted/80 [&_svg]:h-3 [&_svg]:w-3"
                tooltip="Copy JSON"
              />
            )}
            {collapsible && !isEmpty && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center justify-center w-6 h-6 rounded-sm hover:bg-muted/80 transition-colors duration-150"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={cn("p-4 bg-background overflow-auto")}
        style={!isExpanded ? { maxHeight } : undefined}
      >
        {isEmpty ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <JsonFormatter data={data} />
        )}
      </div>
    </div>
  );
}
