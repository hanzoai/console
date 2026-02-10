import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  COORDINATE_SYSTEM,
  OrthographicController,
  OrthographicView,
  type OrthographicViewState,
} from "@deck.gl/core";
import type { PickingInfo } from "@deck.gl/core";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import type { WorkflowDAGLightweightNode } from "../../types/workflows";
import { HoverDetailPanel } from "./HoverDetailPanel";

export type WorkflowDAGNode = WorkflowDAGLightweightNode & {
  workflow_id?: string;
};

interface DeckNode {
  id: string;
  position: [number, number, number];
  depth: number;
  radius: number;
  fillColor: [number, number, number, number];
  borderColor: [number, number, number, number];
  glowColor: [number, number, number, number];
  original: WorkflowDAGNode;
}

interface DeckEdge {
  id: string;
  path: [number, number, number][];
  color: [number, number, number, number];
  width: number;
}

export interface AgentPaletteEntry {
  agentId: string;
  label: string;
  color: string;
  background: string;
  text: string;
}

interface WorkflowDeckGLViewProps {
  nodes: DeckNode[];
  edges: DeckEdge[];
  onNodeClick?: (node: WorkflowDAGNode) => void;
  onNodeHover?: (node: WorkflowDAGNode | null) => void;
}

export interface DeckGraphData {
  nodes: DeckNode[];
  edges: DeckEdge[];
  agentPalette: AgentPaletteEntry[];
}

const initialViewState: OrthographicViewState = {
  target: [0, 0, 0],
  zoom: 0,
  maxZoom: 8,
  minZoom: -6,
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;

  if (sat === 0) {
    const val = Math.round(light * 255);
    return [val, val, val];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const hk = h / 360;

  const r = Math.round(hue2rgb(p, q, hk + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hk) * 255);
  const b = Math.round(hue2rgb(p, q, hk - 1 / 3) * 255);

  return [r, g, b];
}

// Professional color palette optimized for dark backgrounds
const PROFESSIONAL_PALETTE = [
  { h: 210, s: 48, l: 62 }, // Soft blue
  { h: 165, s: 45, l: 58 }, // Teal
  { h: 280, s: 50, l: 64 }, // Purple
  { h: 30, s: 52, l: 62 },  // Coral
  { h: 340, s: 48, l: 64 }, // Pink
  { h: 130, s: 42, l: 58 }, // Green
  { h: 45, s: 50, l: 60 },  // Amber
  { h: 260, s: 46, l: 62 }, // Violet
  { h: 190, s: 44, l: 60 }, // Cyan
  { h: 15, s: 48, l: 62 },  // Orange-red
];

function getAgentColor(agentId: string, index: number): {
  rgb: [number, number, number];
  css: string;
} {
  const hash = hashString(agentId || `agent-${index}`);

  // Use professional palette with consistent distribution
  const paletteIndex = hash % PROFESSIONAL_PALETTE.length;
  const palette = PROFESSIONAL_PALETTE[paletteIndex];

  // Add slight variation to avoid exact duplicates
  const hueVariation = (hash % 20) - 10; // ±10 degrees
  const hue = (palette.h + hueVariation + 360) % 360;

  const rgb = hslToRgb(hue, palette.s, palette.l);
  return { rgb, css: `rgb(${rgb.join(",")})` };
}

function mixColor(
  color: [number, number, number],
  target: [number, number, number],
  ratio: number
): [number, number, number] {
  return [
    Math.round(color[0] * ratio + target[0] * (1 - ratio)),
    Math.round(color[1] * ratio + target[1] * (1 - ratio)),
    Math.round(color[2] * ratio + target[2] * (1 - ratio)),
  ];
}

export const WorkflowDeckGLView = ({
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
}: WorkflowDeckGLViewProps) => {
  const [viewState, setViewState] =
    useState<OrthographicViewState>(initialViewState);

  // Interactive state management
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [relatedNodeIds, setRelatedNodeIds] = useState<Set<string>>(new Set());
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<WorkflowDAGNode | null>(null);

  // Debounce timer ref
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build relationship maps for efficient traversal
  const { parentMap, childMap } = useMemo(() => {
    const parentMap = new Map<string, string>();
    const childMap = new Map<string, string[]>();

    nodes.forEach(node => {
      const parentId = node.original.parent_execution_id;
      if (parentId) {
        parentMap.set(node.id, parentId);
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(node.id);
      }
    });

    return { parentMap, childMap };
  }, [nodes]);

  // Get related nodes (1 level: direct parents and children)
  const getRelatedNodes = useCallback((nodeId: string): Set<string> => {
    const related = new Set<string>();

    // Add the node itself
    related.add(nodeId);

    // Add parent
    const parent = parentMap.get(nodeId);
    if (parent) {
      related.add(parent);
    }

    // Add children
    const children = childMap.get(nodeId) || [];
    children.forEach(child => related.add(child));

    return related;
  }, [parentMap, childMap]);

  // Debounced hover handler
  const handleHover = useCallback((info: PickingInfo) => {
    // Clear existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Debounce hover by 50ms
    hoverTimerRef.current = setTimeout(() => {
      const deckNode = info.object as DeckNode | undefined;

      if (deckNode?.original) {
        setHoveredNodeId(deckNode.id);
        setHoveredNode(deckNode.original);
        setHoverPosition({ x: info.x, y: info.y });
        onNodeHover?.(deckNode.original);
      } else {
        setHoveredNodeId(null);
        setHoveredNode(null);
        onNodeHover?.(null);
      }
    }, 50);
  }, [onNodeHover]);

  // Click handler with relationship traversal
  const handleClick = useCallback((info: PickingInfo) => {
    const deckNode = info.object as DeckNode | undefined;

    if (deckNode?.original) {
      const nodeId = deckNode.id;

      // Toggle selection: if clicking the same node, deselect
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
        setRelatedNodeIds(new Set());
      } else {
        setSelectedNodeId(nodeId);
        const related = getRelatedNodes(nodeId);
        setRelatedNodeIds(related);
      }

      // Call parent handler for sidebar
      onNodeClick?.(deckNode.original);
    }
  }, [selectedNodeId, getRelatedNodes, onNodeClick]);

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!nodes.length) return;

    const xs = nodes.map((node) => node.position[0]);
    const ys = nodes.map((node) => node.position[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 100;
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    setViewState((prev) => ({
      ...prev,
      target: [minX + width / 2, minY + height / 2, 0],
      zoom: Math.log2(Math.min(1200 / (width + padding), 800 / (height + padding))),
    }));
  }, [nodes]);

  // Dynamic node styling based on selection and hover state
  const styledNodes = useMemo(() => {
    const hasSelection = selectedNodeId !== null;

    return nodes.map(node => {
      const isSelected = node.id === selectedNodeId;
      const isRelated = relatedNodeIds.has(node.id) && !isSelected;
      const isHovered = node.id === hoveredNodeId;
      const isDimmed = hasSelection && !isSelected && !isRelated;

      // Calculate dynamic properties
      let fillColor = [...node.fillColor] as [number, number, number, number];
      let borderColor = [...node.borderColor] as [number, number, number, number];
      let radius = node.radius;

      if (isDimmed) {
        // Dimmed nodes: 25% opacity, desaturated
        fillColor[3] = Math.round(fillColor[3] * 0.25);
        borderColor[3] = Math.round(borderColor[3] * 0.25);
      } else if (isSelected) {
        // Selected node: bright border, intense glow, scale up
        fillColor[3] = 255;
        borderColor = [59, 130, 246, 255]; // Bright blue border
        radius = node.radius * 1.15;
      } else if (isRelated) {
        // Related nodes: secondary highlight, 90% opacity
        fillColor[3] = Math.round(fillColor[3] * 0.9);
        borderColor = [34, 197, 94, 220]; // Green tint for related
      } else if (isHovered) {
        // Hovered node: scale up slightly
        radius = node.radius * 1.05;
      }

      return {
        ...node,
        fillColor,
        borderColor,
        radius,
      };
    });
  }, [nodes, selectedNodeId, relatedNodeIds, hoveredNodeId]);

  // Dynamic edge styling based on selection
  const styledEdges = useMemo(() => {
    const hasSelection = selectedNodeId !== null;

    return edges.map(edge => {
      // Extract source and target from edge ID (format: "source-target")
      const [sourceId, targetId] = edge.id.split('-');

      const sourceSelected = relatedNodeIds.has(sourceId);
      const targetSelected = relatedNodeIds.has(targetId);
      const isRelatedEdge = sourceSelected && targetSelected;
      const isPartiallyRelated = sourceSelected || targetSelected;
      const isDimmed = hasSelection && !isRelatedEdge && !isPartiallyRelated;

      let color = [...edge.color] as [number, number, number, number];
      let width = edge.width;

      if (isDimmed) {
        // Dimmed edges: very low opacity
        color[3] = Math.round(color[3] * 0.15);
        width = edge.width * 0.6;
      } else if (isRelatedEdge) {
        // Fully related edge: bright and thick
        color = [59, 130, 246, 255]; // Bright blue
        width = edge.width * 1.5;
      } else if (isPartiallyRelated) {
        // Partially related: semi-bright
        color = [59, 130, 246, 180];
        width = edge.width * 1.2;
      }

      return {
        ...edge,
        color,
        width,
      };
    });
  }, [edges, selectedNodeId, relatedNodeIds]);

  const layers = useMemo(() => {
    const nodeLayer = new ScatterplotLayer<DeckNode>({
      id: "workflow-nodes",
      data: styledNodes,
      pickable: true,
      radiusScale: 1,
      radiusMinPixels: 2,
      radiusMaxPixels: 24,
      getPosition: (node) => node.position,
      getRadius: (node) => node.radius,
      getFillColor: (node) => node.fillColor,
      getLineColor: (node) => node.borderColor,
      getLineWidth: () => 1.2,
      lineWidthMinPixels: 1,
      lineWidthMaxPixels: 3,
      stroked: true,
      autoHighlight: false, // Disable auto-highlight, we handle it manually
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      onClick: handleClick,
      onHover: handleHover,
      // Performance: update triggers for efficient re-rendering
      updateTriggers: {
        getFillColor: [selectedNodeId, relatedNodeIds, hoveredNodeId],
        getLineColor: [selectedNodeId, relatedNodeIds],
        getRadius: [selectedNodeId, hoveredNodeId],
      },
      // Smooth transitions
      transitions: {
        getFillColor: 200,
        getLineColor: 200,
        getRadius: 200,
      },
    });

    const edgeLayer = new PathLayer<DeckEdge>({
      id: "workflow-edges",
      data: styledEdges,
      getPath: (edge) => edge.path,
      getColor: (edge) => edge.color,
      getWidth: (edge) => edge.width,
      widthMinPixels: 1,
      widthMaxPixels: 6,
      widthUnits: "pixels",
      rounded: true,
      miterLimit: 2,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      // Performance: update triggers
      updateTriggers: {
        getColor: [selectedNodeId, relatedNodeIds],
        getWidth: [selectedNodeId, relatedNodeIds],
      },
      // Smooth transitions
      transitions: {
        getColor: 200,
        getWidth: 200,
      },
    });

    return [edgeLayer, nodeLayer];
  }, [styledNodes, styledEdges, handleClick, handleHover, selectedNodeId, relatedNodeIds, hoveredNodeId]);

  return (
    <div className="relative h-full w-full bg-muted/30">
      <DeckGL
        views={new OrthographicView({})}
        controller={{ type: OrthographicController, inertia: true }}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) =>
          setViewState(next as OrthographicViewState)
        }
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        getCursor={() => hoveredNodeId ? 'pointer' : 'grab'}
      />

      {/* Hover Detail Panel */}
      <HoverDetailPanel
        node={hoveredNode}
        position={hoverPosition}
        visible={!!hoveredNode && !selectedNodeId}
      />
    </div>
  );
};

const BACKGROUND_RGB: [number, number, number] = [11, 18, 32];

// Status color mapping matching React Flow's status system
const STATUS_COLORS: Record<string, [number, number, number]> = {
  succeeded: [34, 197, 94],    // Green - matches --status-success
  failed: [239, 68, 68],       // Red - matches --status-error
  running: [59, 130, 246],     // Blue - matches --status-info
  pending: [251, 191, 36],     // Amber - matches --status-warning
  queued: [251, 191, 36],      // Amber - matches --status-warning
  timeout: [148, 163, 184],    // Neutral gray
  cancelled: [148, 163, 184],  // Neutral gray
  unknown: [148, 163, 184],    // Neutral gray
};

function normalizeStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('success') || normalized.includes('complete')) return 'succeeded';
  if (normalized.includes('fail') || normalized.includes('error')) return 'failed';
  if (normalized.includes('run') || normalized.includes('progress')) return 'running';
  if (normalized.includes('pend')) return 'pending';
  if (normalized.includes('queue')) return 'queued';
  if (normalized.includes('timeout')) return 'timeout';
  if (normalized.includes('cancel')) return 'cancelled';
  return normalized;
}

function getStatusColor(status: string): [number, number, number] {
  const normalized = normalizeStatus(status);
  return STATUS_COLORS[normalized] || STATUS_COLORS.unknown;
}

/**
 * Create a smooth cubic Bezier curve between two points
 * Optimized: Only 8 segments instead of 32 for better performance
 */
function createCubicBezier(
  source: [number, number, number],
  target: [number, number, number],
  curvature: number = 0.5
): [number, number, number][] {
  const dy = target[1] - source[1];

  // Control points for smooth S-curve (top-to-bottom flow)
  const control1: [number, number, number] = [
    source[0],
    source[1] + dy * curvature,
    source[2],
  ];

  const control2: [number, number, number] = [
    target[0],
    target[1] - dy * curvature,
    target[2],
  ];

  // Sample the curve with fewer points for performance
  const points: [number, number, number][] = [];
  const segments = 8; // Reduced from 32 for better performance

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x =
      mt * mt * mt * source[0] +
      3 * mt * mt * t * control1[0] +
      3 * mt * t * t * control2[0] +
      t * t * t * target[0];
    const y =
      mt * mt * mt * source[1] +
      3 * mt * mt * t * control1[1] +
      3 * mt * t * t * control2[1] +
      t * t * t * target[1];
    const z =
      mt * mt * mt * source[2] +
      3 * mt * mt * t * control1[2] +
      3 * mt * t * t * control2[2] +
      t * t * t * target[2];
    points.push([x, y, z]);
  }

  return points;
}

/**
 * Build a hierarchical DAG layout optimized for scalability
 * Uses layer-based positioning for clear directional flow
 */
export function buildDeckGraph(
  timeline: WorkflowDAGNode[],
  horizontalSpacing: number = 120,
  verticalSpacing: number = 100
): DeckGraphData {
  if (!timeline.length) {
    return { nodes: [], edges: [], agentPalette: [] };
  }

  const nodeById = new Map<string, WorkflowDAGNode>();
  const childrenByParent = new Map<string, WorkflowDAGNode[]>();
  const parentsByChild = new Map<string, string[]>();
  const agentColors = new Map<
    string,
    { rgb: [number, number, number]; css: string }
  >();

  // Build graph structure
  timeline.forEach((node, index) => {
    nodeById.set(node.execution_id, node);

    if (node.parent_execution_id) {
      // Track children
      if (!childrenByParent.has(node.parent_execution_id)) {
        childrenByParent.set(node.parent_execution_id, []);
      }
      childrenByParent.get(node.parent_execution_id)!.push(node);

      // Track parents
      if (!parentsByChild.has(node.execution_id)) {
        parentsByChild.set(node.execution_id, []);
      }
      parentsByChild.get(node.execution_id)!.push(node.parent_execution_id);
    }

    // Generate agent colors
    const agentId = node.agent_node_id || `agent-${index}`;
    if (!agentColors.has(agentId)) {
      agentColors.set(agentId, getAgentColor(agentId, agentColors.size));
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[DeckGL] Processing",
      timeline.length,
      "nodes with",
      childrenByParent.size,
      "parent nodes"
    );
  }

  // Find root nodes (nodes with no parents or parents not in the graph)
  const roots = timeline.filter(
    (node) =>
      !node.parent_execution_id ||
      !nodeById.has(node.parent_execution_id)
  );

  if (roots.length === 0 && timeline.length > 0) {
    // Fallback: use node with smallest depth
    const fallbackRoot = timeline.reduce((best, node) => {
      const depth = node.workflow_depth ?? Infinity;
      const bestDepth = best.workflow_depth ?? Infinity;
      return depth < bestDepth ? node : best;
    });
    roots.push(fallbackRoot);
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[DeckGL] Found", roots.length, "root nodes");
  }

  // Assign nodes to layers using topological sort (BFS)
  const layers: WorkflowDAGNode[][] = [];
  const nodeToLayer = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { node: WorkflowDAGNode; layer: number }[] = [];

  // Initialize with roots
  roots.forEach((root) => {
    queue.push({ node: root, layer: 0 });
  });

  while (queue.length > 0) {
    const { node, layer } = queue.shift()!;

    if (visited.has(node.execution_id)) {
      // If already visited, potentially update layer if this path is longer
      const currentLayer = nodeToLayer.get(node.execution_id)!;
      if (layer > currentLayer) {
        // Remove from old layer
        const oldLayerNodes = layers[currentLayer];
        const idx = oldLayerNodes.findIndex(n => n.execution_id === node.execution_id);
        if (idx >= 0) oldLayerNodes.splice(idx, 1);

        // Add to new layer
        nodeToLayer.set(node.execution_id, layer);
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(node);
      }
      continue;
    }

    visited.add(node.execution_id);
    nodeToLayer.set(node.execution_id, layer);

    if (!layers[layer]) {
      layers[layer] = [];
    }
    layers[layer].push(node);

    // Add children to next layer
    const children = childrenByParent.get(node.execution_id) ?? [];
    children.forEach((child) => {
      queue.push({ node: child, layer: layer + 1 });
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[DeckGL] Created",
      layers.length,
      "layers, max layer size:",
      Math.max(...layers.map(l => l.length))
    );
  }

  // Position nodes in each layer
  const layoutInfo = new Map<
    string,
    {
      position: [number, number, number];
      layer: number;
      color: [number, number, number];
      agentId: string;
      radius: number;
    }
  >();

  layers.forEach((layerNodes, layerIndex) => {
    const layerWidth = (layerNodes.length - 1) * horizontalSpacing;
    const startX = -layerWidth / 2;

    layerNodes.forEach((node, indexInLayer) => {
      const x = startX + indexInLayer * horizontalSpacing;
      const y = layerIndex * verticalSpacing;
      const z = 0; // Keep flat for now

      const agentId = node.agent_node_id || node.reasoner_id || "agent";
      const colorInfo =
        agentColors.get(agentId) ??
        getAgentColor(agentId, agentColors.size + 1);
      const baseColor = colorInfo.rgb;

      // Node size based on depth (earlier nodes slightly larger)
      const baseRadius = Math.max(6, 12 - layerIndex * 0.3);

      layoutInfo.set(node.execution_id, {
        position: [x, y, z],
        layer: layerIndex,
        color: baseColor,
        agentId,
        radius: baseRadius,
      });
    });
  });

  // Create deck nodes with depth-based opacity and status-based colors
  const deckNodes: DeckNode[] = [];
  const maxDepth = Math.max(...Array.from(layoutInfo.values()).map(i => i.layer));

  layoutInfo.forEach((info, nodeId) => {
    const node = nodeById.get(nodeId)!;
    const statusColor = getStatusColor(node.status);

    // Mix agent color (70%) with status color (30%) for visual distinction
    const mixedColor = mixColor(info.color, statusColor, 0.7);

    // Subtle depth-based opacity fade (240 -> 200 over full depth)
    const depthFactor = maxDepth > 0 ? info.layer / maxDepth : 0;
    const opacity = Math.round(240 - depthFactor * 40);

    const fill = [...mixedColor, opacity] as [number, number, number, number];

    // Border uses agent color for consistency
    const border = [...mixColor(info.color, BACKGROUND_RGB, 0.35), 255] as [
      number,
      number,
      number,
      number,
    ];

    // Glow uses status color for visual feedback
    const glow = [...mixColor(statusColor, [255, 255, 255], 0.25), 90] as [
      number,
      number,
      number,
      number,
    ];

    deckNodes.push({
      id: nodeId,
      position: info.position,
      depth: info.layer,
      radius: info.radius,
      fillColor: fill,
      borderColor: border,
      glowColor: glow,
      original: nodeById.get(nodeId)!,
    });
  });

  // Create edges with smooth curves
  const deckEdges: DeckEdge[] = [];
  timeline.forEach((node) => {
    if (!node.parent_execution_id) {
      return;
    }

    const parentInfo = layoutInfo.get(node.parent_execution_id);
    const childInfo = layoutInfo.get(node.execution_id);
    if (!parentInfo || !childInfo) {
      return;
    }

    const source = parentInfo.position;
    const target = childInfo.position;

    // Calculate curvature based on distance (top-to-bottom)
    const dy = Math.abs(target[1] - source[1]);
    const curvature = Math.min(0.6, 0.3 + dy / 1000);

    const path = createCubicBezier(source, target, curvature);

    const baseColor = parentInfo.color;
    // Softer edge colors with depth-based opacity
    const depthFactor = maxDepth > 0 ? childInfo.layer / maxDepth : 0;
    const edgeOpacity = Math.round(120 - depthFactor * 30); // 120 -> 90
    const edgeColor = [
      ...mixColor(baseColor, BACKGROUND_RGB, 0.55),
      edgeOpacity,
    ] as [number, number, number, number];

    // Edge width decreases with depth
    const width = Math.max(1, 2.2 - childInfo.layer * 0.12);

    deckEdges.push({
      id: `${node.parent_execution_id}-${node.execution_id}`,
      path,
      color: edgeColor,
      width,
    });
  });

  // Build agent palette
  const agentPalette: AgentPaletteEntry[] = [];
  agentColors.forEach((value, key) => {
    const background = mixColor(value.rgb, BACKGROUND_RGB, 0.85);
    const luminance =
      value.rgb[0] * 0.2126 + value.rgb[1] * 0.7152 + value.rgb[2] * 0.0722;
    const textColor = luminance > 140 ? "#0f172a" : "#f8fafc";
    agentPalette.push({
      agentId: key,
      label: key,
      color: value.css,
      background: `rgb(${background.join(",")})`,
      text: textColor,
    });
  });
  agentPalette.sort((a, b) => a.label.localeCompare(b.label));

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[DeckGL] Built",
      deckNodes.length,
      "nodes and",
      deckEdges.length,
      "edges"
    );
  }

  return { nodes: deckNodes, edges: deckEdges, agentPalette };
}
