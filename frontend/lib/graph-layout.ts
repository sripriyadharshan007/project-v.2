import type { Node, Edge } from '@xyflow/react';

// ── Simple top-down tree layout ────────────────────────────────────────────────
// We do a BFS from the start node and assign x/y positions level by level.
// This avoids needing a heavy external library like Dagre.

const NODE_WIDTH  = 200;
const NODE_HEIGHT = 90;
const H_GAP       = 60;   // horizontal gap between sibling nodes
const V_GAP       = 100;  // vertical gap between levels

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function buildGraphLayout(
  nodes: Node[],
  edges: Edge[],
  startNodeId: string | null,
): LayoutResult {

  if (nodes.length === 0) return { nodes, edges };

  // Build adjacency (id → [childIds])
  const children = new Map<string, string[]>();
  nodes.forEach((n) => children.set(n.id, []));
  edges.forEach((e) => {
    const list = children.get(e.source);
    if (list && !list.includes(e.target)) list.push(e.target);
  });

  // BFS from startNodeId (or first node as fallback)
  const root      = startNodeId ?? nodes[0]?.id;
  const levels    = new Map<string, number>(); // id → level
  const visited   = new Set<string>();
  const queue: string[] = [root];
  levels.set(root, 0);
  visited.add(root);

  while (queue.length) {
    const current = queue.shift()!;
    const level   = levels.get(current)!;
    for (const child of (children.get(current) ?? [])) {
      if (!visited.has(child)) {
        visited.add(child);
        levels.set(child, level + 1);
        queue.push(child);
      }
    }
  }

  // Assign remaining unvisited nodes (disconnected) at the end
  let maxLevel = Math.max(0, ...Array.from(levels.values()));
  nodes.forEach((n) => {
    if (!levels.has(n.id)) {
      maxLevel += 1;
      levels.set(n.id, maxLevel);
    }
  });

  // Group nodes by level
  const byLevel = new Map<number, string[]>();
  Array.from(levels.entries()).forEach(([id, lvl]) => {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  });

  // Compute positions
  const positions = new Map<string, { x: number; y: number }>();
  Array.from(byLevel.entries()).forEach(([level, ids]) => {
    const totalWidth = ids.length * NODE_WIDTH + (ids.length - 1) * H_GAP;
    const startX     = -totalWidth / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: startX + i * (NODE_WIDTH + H_GAP),
        y: level  * (NODE_HEIGHT + V_GAP),
      });
    });
  });

  const layoutedNodes: Node[] = nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? { x: 0, y: 0 },
  }));

  return { nodes: layoutedNodes, edges };
}
