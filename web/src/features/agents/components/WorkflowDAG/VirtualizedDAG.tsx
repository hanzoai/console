import {
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  Panel,
  Background,
  BackgroundVariant,
  ConnectionMode,
} from "@xyflow/react";
import React, { useCallback, useMemo, useRef } from "react";

import { AgentLegend } from "./AgentLegend";
import { LayoutControls } from "./LayoutControls";
import FloatingConnectionLine from "./FloatingConnectionLine";
import type { AllLayoutType } from "./layouts/LayoutManager";

interface VirtualizedDAGProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  nodeTypes: Record<string, React.ComponentType<any>>;
  edgeTypes?: Record<string, React.ComponentType<any>>;
  className?: string;
  threshold?: number; // Number of nodes above which to use virtualization
  workflowId: string; // used to persist viewport per workflow
  // Layout-related props
  currentLayout: AllLayoutType;
  onLayoutChange: (layout: AllLayoutType) => Promise<void>;
  availableLayouts: AllLayoutType[];
  isSlowLayout: (layout: AllLayoutType) => boolean;
  getLayoutDescription: (layout: AllLayoutType) => string;
  isLargeGraph: boolean;
  isApplyingLayout: boolean;
  layoutProgress: number;
  // Agent filtering props
  onAgentFilter: (agentName: string | null) => void;
  selectedAgent: string | null;
}

// Performance-optimized DAG component
export function VirtualizedDAG({
  nodes,
  edges,
  onNodeClick,
  nodeTypes,
  edgeTypes,
  className,
  workflowId,
  currentLayout,
  onLayoutChange,
  availableLayouts,
  isSlowLayout,
  getLayoutDescription,
  isLargeGraph,
  isApplyingLayout,
  layoutProgress,
  onAgentFilter,
  selectedAgent,
}: VirtualizedDAGProps) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);
  const { fitView, setViewport } = useReactFlow();

  const defaultViewport = useMemo(
    () => ({ x: 0, y: 0, zoom: 0.8 }),
    []
  );
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>(defaultViewport);
  const hasInitializedViewportRef = useRef(false);
  const viewportStorageKey = useMemo(
    () => `workflowDAGViewport:${workflowId}`,
    [workflowId]
  );

  // Memoized fitViewOptions to prevent unnecessary re-renders
  const fitViewOptions = React.useMemo(
    () => ({
      padding: 0.2,
      includeHiddenNodes: false,
      minZoom: 0,
      maxZoom: 2,
    }),
    []
  );

  // Optimized node click handler with stable reference
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClick?.(event, node);
    },
    [onNodeClick]
  );

  // Update nodes when props change
  React.useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  // Update edges when props change
  React.useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

  // Initialize/restore viewport once; preserve on subsequent updates
  React.useEffect(() => {
    if (!hasInitializedViewportRef.current) {
      const saved = localStorage.getItem(viewportStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          viewportRef.current = parsed;
          setTimeout(() => setViewport(parsed), 0);
        } catch {
          setTimeout(() => fitView({ padding: 0.2 }), 100);
        }
      } else {
        setTimeout(() => fitView({ padding: 0.2 }), 100);
      }
      hasInitializedViewportRef.current = true;
    } else {
      const vp = viewportRef.current;
      setTimeout(() => setViewport(vp), 0);
    }
  }, [flowNodes.length, flowEdges.length, viewportStorageKey, fitView, setViewport]);

  // Always use ReactFlow but with performance optimizations for large graphs
  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onMoveEnd={(_, viewport) => {
        viewportRef.current = viewport;
        try {
          localStorage.setItem(
            viewportStorageKey,
            JSON.stringify(viewport)
          );
        } catch {}
      }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionLineComponent={FloatingConnectionLine}
      connectionMode={ConnectionMode.Strict}
      // Allow node dragging but disable edge creation
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      className={className}
      fitViewOptions={fitViewOptions}
      defaultViewport={defaultViewport}
      minZoom={0}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--border)"
      />

      {/* Agent Legend */}
      <Panel position="top-left" className="z-10">
        <AgentLegend
          onAgentFilter={onAgentFilter}
          selectedAgent={selectedAgent}
          compact={nodes.length <= 20}
          nodes={flowNodes}
        />
      </Panel>

      {/* Enhanced Layout Controls */}
      <Panel position="top-right" className="flex gap-2">
        <LayoutControls
          availableLayouts={availableLayouts}
          currentLayout={currentLayout}
          onLayoutChange={onLayoutChange}
          isSlowLayout={isSlowLayout}
          getLayoutDescription={getLayoutDescription}
          isLargeGraph={isLargeGraph}
          isApplyingLayout={isApplyingLayout}
          layoutProgress={layoutProgress}
        />
      </Panel>
    </ReactFlow>
  );
}

// Wrapper with ReactFlowProvider for standalone use
export function VirtualizedDAGWithProvider(props: VirtualizedDAGProps) {
  return (
    <ReactFlowProvider>
      <VirtualizedDAG {...props} />
    </ReactFlowProvider>
  );
}
