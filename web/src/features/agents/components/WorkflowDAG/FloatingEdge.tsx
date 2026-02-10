import { getBezierPath, useInternalNode, EdgeLabelRenderer } from "@xyflow/react";
import { normalizeExecutionStatus } from "../../utils/status";
import { getEdgeParams } from "./EdgeUtils";

interface FloatingEdgeProps {
  id: string;
  source: string;
  target: string;
  markerEnd?: string;
  style?: React.CSSProperties;
  data?: {
    status?: string;
    duration?: number;
    animated?: boolean;
    emphasis?: 'focus' | 'search' | 'muted' | 'default';
  };
}

function FloatingEdge({ id, source, target, style = {}, data }: FloatingEdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode,
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  const status = data?.status || "default";
  const canonicalStatus = normalizeExecutionStatus(status);
  const isAnimated = data?.animated || canonicalStatus === "running";
  const duration = data?.duration;

  // Status-based styling
  const getStatusStyle = () => {
    const baseStyle = {
      stroke: (() => {
        switch (canonicalStatus) {
          case "succeeded":
            return "var(--status-success)";
          case "failed":
            return "var(--status-error)";
          case "running":
            return "var(--status-info)";
          case "pending":
          case "queued":
            return "var(--status-warning)";
          default:
            return "color-mix(in srgb, var(--muted-foreground) 65%, transparent)";
        }
      })(),
      strokeWidth: 2,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      filter:
        "drop-shadow(0 1px 2px color-mix(in srgb, var(--foreground) 12%, transparent))",
    };

    switch (canonicalStatus) {
      case "succeeded":
        return {
          ...baseStyle,
          strokeWidth: 2.5,
        };
      case "failed":
        return {
          ...baseStyle,
          strokeWidth: 2.5,
          strokeDasharray: "8,4",
        };
      case "running":
        return {
          ...baseStyle,
          strokeWidth: 3,
          strokeDasharray: "12,8",
          animation: "dash 2s linear infinite",
        };
      case "pending":
      case "queued":
        return {
          ...baseStyle,
          strokeWidth: 2,
          opacity: 0.7,
        };
      default:
        return {
          ...baseStyle,
          opacity: 0.6,
        };
    }
  };

  const emphasis = data?.emphasis;

  const edgeStyle = {
    ...getStatusStyle(),
    ...style,
  } as React.CSSProperties;

  if (emphasis === 'muted') {
    edgeStyle.opacity = Math.min(Number(edgeStyle.opacity ?? 1), 0.18);
    edgeStyle.filter = 'grayscale(80%)';
    edgeStyle.strokeDasharray = edgeStyle.strokeDasharray || '6,4';
  } else if (emphasis === 'focus') {
    edgeStyle.opacity = 1;
    edgeStyle.strokeWidth = Math.max(Number(edgeStyle.strokeWidth ?? 2.5), 3.6);
    edgeStyle.filter = `${edgeStyle.filter || ''} drop-shadow(0 0 6px color-mix(in srgb, var(--status-success) 45%, transparent))`.trim();
  } else if (emphasis === 'search') {
    edgeStyle.opacity = Math.max(Number(edgeStyle.opacity ?? 0.85), 0.9);
    edgeStyle.strokeWidth = Math.max(Number(edgeStyle.strokeWidth ?? 2.4), 3);
    edgeStyle.filter = `${edgeStyle.filter || ''} drop-shadow(0 0 6px color-mix(in srgb, var(--status-info) 40%, transparent))`.trim();
  }

  // Enhanced marker end
  const markerKey = canonicalStatus;
  const enhancedMarkerEnd = `url(#arrowclosed-${markerKey})`;
  const strokeColor = (edgeStyle.stroke as string) || "var(--muted-foreground)";

  return (
    <>
      <defs>
        <marker
          id={`arrowclosed-${markerKey}`}
          markerWidth={canonicalStatus === "running" ? 16 : 12}
          markerHeight={canonicalStatus === "running" ? 16 : 12}
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,0 0,6 9,3"
            fill={strokeColor}
            stroke={strokeColor}
          />
        </marker>
      </defs>

      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={enhancedMarkerEnd}
        style={edgeStyle}
      />

      {/* Duration label for completed edges */}
      {duration && canonicalStatus === "succeeded" && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <div className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-body-small shadow-sm backdrop-blur-sm">
              {duration < 1000
                ? `${duration}ms`
                : `${(duration / 1000).toFixed(1)}s`}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Animated flow particles for running edges */}
      {isAnimated && canonicalStatus === "running" && (
        <g>
          <circle r="3" fill={strokeColor}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>
    </>
  );
}

export default FloatingEdge;
