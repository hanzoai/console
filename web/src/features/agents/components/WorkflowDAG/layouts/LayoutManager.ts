import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { ELKLayoutEngine, type ELKLayoutType } from './ELKLayoutEngine';

export type DagreLayoutType = 'tree' | 'flow';
export type AllLayoutType = DagreLayoutType | ELKLayoutType;

interface LayoutWorkerRequestMessage {
  id: string;
  nodes: Node[];
  edges: Edge[];
  layoutType: AllLayoutType;
}

type LayoutWorkerResponseMessage =
  | { id: string; type: 'progress'; value: number }
  | { id: string; type: 'result'; nodes: Node[]; edges: Edge[] }
  | { id: string; type: 'error'; message: string };

export interface LayoutManagerConfig {
  smallGraphThreshold: number; // Threshold for switching to ELK layouts
  performanceThreshold: number; // Threshold for virtualized rendering
  enableWorker?: boolean;
}

const DEFAULT_CONFIG: LayoutManagerConfig = {
  smallGraphThreshold: 50,
  performanceThreshold: 300,
  enableWorker: false,
};

export class LayoutManager {
  private elkEngine: ELKLayoutEngine;
  private config: LayoutManagerConfig;
  private layoutWorker?: Worker;
  private pendingWorkerRequests = new Map<
    string,
    {
      resolve: (value: { nodes: Node[]; edges: Edge[] }) => void;
      reject: (error: Error) => void;
      onProgress?: (progress: number) => void;
    }
  >();
  private workerRequestCounter = 0;
  private workerEnabled: boolean;

  constructor(config: Partial<LayoutManagerConfig> = {}) {
    this.elkEngine = new ELKLayoutEngine();
    this.config = { ...DEFAULT_CONFIG, ...config };

    const shouldEnableWorker =
      this.config.enableWorker === true &&
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof URL !== 'undefined';

    this.workerEnabled = shouldEnableWorker;

    if (this.workerEnabled) {
      this.initializeWorker();
    }
  }

  private initializeWorker(): void {
    try {
      this.layoutWorker = new Worker(new URL('./layoutWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.layoutWorker.onmessage = (event: MessageEvent<LayoutWorkerResponseMessage>) =>
        this.handleWorkerMessage(event);
      this.layoutWorker.onerror = (event) => {
        console.error('Layout worker error:', event.message);
        this.rejectPendingWorkerRequests(
          new Error(`layout worker error: ${event.message ?? 'unknown error'}`),
        );
        this.disposeWorker();
      };
    } catch (error) {
      console.warn('Failed to initialize layout worker, falling back to main thread:', error);
      this.layoutWorker = undefined;
      this.workerEnabled = false;
    }
  }

  private handleWorkerMessage(event: MessageEvent<LayoutWorkerResponseMessage>): void {
    const message = event.data;
    const pending = this.pendingWorkerRequests.get(message.id);
    if (!pending) {
      return;
    }

    if (message.type === 'progress') {
      pending.onProgress?.(message.value);
      return;
    }

    this.pendingWorkerRequests.delete(message.id);

    if (message.type === 'result') {
      pending.onProgress?.(100);
      pending.resolve({ nodes: message.nodes, edges: message.edges });
    } else if (message.type === 'error') {
      pending.reject(new Error(message.message));
      this.disposeWorker();
    }
  }

  private rejectPendingWorkerRequests(error: Error): void {
    this.pendingWorkerRequests.forEach(({ reject }) => reject(error));
    this.pendingWorkerRequests.clear();
  }

  private disposeWorker(): void {
    if (this.layoutWorker) {
      this.layoutWorker.terminate();
      this.layoutWorker = undefined;
    }
    this.pendingWorkerRequests.clear();
    this.workerEnabled = false;
  }

  private applyLayoutWithWorker(
    nodes: Node[],
    edges: Edge[],
    layoutType: AllLayoutType,
    onProgress?: (progress: number) => void,
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    if (!this.layoutWorker) {
      return this.applyLayoutMainThread(nodes, edges, layoutType, onProgress);
    }

    const requestId = `layout-${++this.workerRequestCounter}`;

    return new Promise((resolve, reject) => {
      this.pendingWorkerRequests.set(requestId, { resolve, reject, onProgress });
      try {
        onProgress?.(0);
        this.layoutWorker!.postMessage({
          id: requestId,
          nodes,
          edges,
          layoutType,
        } as LayoutWorkerRequestMessage);
      } catch (error) {
        this.pendingWorkerRequests.delete(requestId);
        console.warn('Failed to post layout job to worker, falling back to main thread:', error);
        this.applyLayoutMainThread(nodes, edges, layoutType, onProgress)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  /**
   * Determine if graph should use ELK layouts based on size
   */
  isLargeGraph(nodeCount: number): boolean {
    return nodeCount >= this.config.smallGraphThreshold;
  }

  /**
   * Get available layout types based on graph size
   */
  getAvailableLayouts(nodeCount: number): AllLayoutType[] {
    if (this.isLargeGraph(nodeCount)) {
      // Large graphs: All layouts available, but ELK layouts preferred
      return [...ELKLayoutEngine.getAvailableLayouts(), 'tree', 'flow'];
    } else {
      // Small graphs: All layouts available, but Dagre layouts preferred
      return ['tree', 'flow', ...ELKLayoutEngine.getAvailableLayouts()];
    }
  }

  /**
   * Get the default layout based on graph size
   */
  getDefaultLayout(nodeCount: number): AllLayoutType {
    if (this.isLargeGraph(nodeCount)) {
      // Large graphs: Default to box layout for performance
      return 'box';
    } else {
      // Small graphs: Default to tree layout
      return 'tree';
    }
  }

  /**
   * Check if a layout type is slow for large graphs
   */
  isSlowLayout(layoutType: AllLayoutType): boolean {
    if (layoutType === 'tree' || layoutType === 'flow') {
      return false; // Dagre layouts are generally fast
    }
    return ELKLayoutEngine.isSlowForLargeGraphs(layoutType as ELKLayoutType);
  }

  /**
   * Get layout description
   */
  getLayoutDescription(layoutType: AllLayoutType): string {
    switch (layoutType) {
      case 'tree':
        return 'Tree layout - Top to bottom hierarchy';
      case 'flow':
        return 'Flow layout - Left to right flow';
      default:
        return ELKLayoutEngine.getLayoutDescription(layoutType as ELKLayoutType);
    }
  }

  /**
   * Apply layout to nodes and edges
   */
  async applyLayout(
    nodes: Node[],
    edges: Edge[],
    layoutType: AllLayoutType,
    onProgress?: (progress: number) => void
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    if (this.layoutWorker) {
      try {
        return await this.applyLayoutWithWorker(nodes, edges, layoutType, onProgress);
      } catch (error) {
        console.warn('Layout worker failed, falling back to main thread:', error);
        this.disposeWorker();
      }
    }

    return this.applyLayoutMainThread(nodes, edges, layoutType, onProgress);
  }

  private async applyLayoutMainThread(
    nodes: Node[],
    edges: Edge[],
    layoutType: AllLayoutType,
    onProgress?: (progress: number) => void,
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    onProgress?.(0);

    try {
      if (layoutType === 'tree' || layoutType === 'flow') {
        // Use Dagre layout
        const result = this.applyDagreLayout(nodes, edges, layoutType);
        onProgress?.(100);
        return result;
      } else {
        // Use ELK layout
        onProgress?.(25);
        const result = await this.elkEngine.applyLayout(nodes, edges, layoutType as ELKLayoutType);
        onProgress?.(100);
        return result;
      }
    } catch (error) {
      console.error('Layout application failed:', error);
      onProgress?.(100);
      return { nodes, edges }; // Return original on failure
    }
  }

  /**
   * Apply Dagre layout (existing implementation)
   */
  private applyDagreLayout(nodes: Node[], edges: Edge[], layoutType: DagreLayoutType): { nodes: Node[]; edges: Edge[] } {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));

    // Calculate average node width for better spacing
    const nodeDimensions = nodes.map(node => this.calculateNodeDimensions(node.data));
    const avgWidth = nodeDimensions.reduce((sum, dim) => sum + dim.width, 0) / nodeDimensions.length;
    const maxWidth = Math.max(...nodeDimensions.map(dim => dim.width));

    // Configure layout with dynamic spacing based on actual node sizes
    const direction = layoutType === 'tree' ? 'TB' : 'LR';
    const spacing = direction === 'TB'
      ? { rankSep: 140, nodeSep: Math.max(100, avgWidth * 0.4) }  // Tree layout: top-to-bottom
      : { rankSep: Math.max(280, maxWidth * 1.2), nodeSep: 120 }; // Flow layout: left-to-right

    g.setGraph({
      rankdir: direction,
      ranksep: spacing.rankSep,
      nodesep: spacing.nodeSep,
      marginx: 60,
      marginy: 60,
    });

    // Add nodes to the graph with their actual dimensions
    nodes.forEach((node, index) => {
      const dimensions = nodeDimensions[index];
      g.setNode(node.id, {
        width: dimensions.width,
        height: dimensions.height,
      });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    dagre.layout(g);

    // Apply positions to nodes using their actual dimensions
    const layoutedNodes = nodes.map((node, index) => {
      const nodeWithPosition = g.node(node.id);
      const dimensions = nodeDimensions[index];
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - dimensions.width / 2,
          y: nodeWithPosition.y - dimensions.height / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  /**
   * Calculate node dimensions (same logic as in original component)
   */
  private calculateNodeDimensions(nodeData: any): { width: number; height: number } {
    const taskText = nodeData.task_name || nodeData.reasoner_id || '';
    const agentText = nodeData.agent_name || nodeData.agent_node_id || '';

    const minWidth = 200;
    const maxWidth = 360;
    const charWidth = 7.5;

    const humanizeText = (text: string): string => {
      return text
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\s+/g, ' ')
        .trim();
    };

    const taskHuman = humanizeText(taskText);
    const agentHuman = humanizeText(agentText);

    const taskWordsLength = taskHuman.split(' ').reduce((max, word) => Math.max(max, word.length), 0);
    const agentWordsLength = agentHuman.split(' ').reduce((max, word) => Math.max(max, word.length), 0);

    const longestWord = Math.max(taskWordsLength, agentWordsLength);
    const estimatedWidth = Math.max(
      longestWord * charWidth * 1.8,
      (taskHuman.length / 2.2) * charWidth,
      (agentHuman.length / 2.2) * charWidth
    ) + 80;

    const width = Math.min(maxWidth, Math.max(minWidth, estimatedWidth));
    const height = 100; // Fixed height as set in WorkflowNode

    return { width, height };
  }

  /**
   * Get configuration
   */
  getConfig(): LayoutManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LayoutManagerConfig>): void {
    const merged = { ...this.config, ...newConfig };
    const workerStateChanged = merged.enableWorker !== this.config.enableWorker;
    this.config = merged;

    if (workerStateChanged) {
      if (this.config.enableWorker && !this.workerEnabled) {
        this.workerEnabled =
          typeof window !== 'undefined' &&
          typeof Worker !== 'undefined' &&
          typeof URL !== 'undefined';
        if (this.workerEnabled) {
          this.initializeWorker();
        }
      } else if (!this.config.enableWorker && this.workerEnabled) {
        this.disposeWorker();
      }
    }
  }
}
