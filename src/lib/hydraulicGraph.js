/**
 * Hydraulic Graph Engine
 * Core data model: nodes (components) + edges (pipes)
 * Water only, tabular local resistance coefficients
 */

// ─── Water properties (heating range 60-90°C) ────────────────────────────────
export const WATER = {
  density: 971.8,      // kg/m³ at 80°C
  viscosity: 0.000365, // m²/s kinematic at 80°C
};

// ─── Tabular local resistance coefficients ζ by pipe material ────────────────
// Source: SP 60.13330.2020, Altshul tables
export const ZETA = {
  // Format: { tee_pass, tee_branch, elbow_90, radiator_in, radiator_out }
  ppr_pn20:     { tee_pass: 0.5, tee_branch: 1.5, elbow_90: 1.5, radiator: 2.5 },
  ppr_pn25:     { tee_pass: 0.5, tee_branch: 1.5, elbow_90: 1.5, radiator: 2.5 },
  metal_plastic:{ tee_pass: 0.3, tee_branch: 1.3, elbow_90: 1.1, radiator: 2.0 },
  pex:          { tee_pass: 0.3, tee_branch: 1.3, elbow_90: 1.1, radiator: 2.0 },
  stainless:    { tee_pass: 0.2, tee_branch: 1.2, elbow_90: 0.9, radiator: 1.8 },
};

// ─── Graph factory helpers ────────────────────────────────────────────────────
let _seq = 1;
export const uid = (prefix = 'n') => `${prefix}-${_seq++}`;
export const resetUid = () => { _seq = 1; };

export function createNode(type, x, y, props = {}) {
  const defaults = {
    pump:     { },
    pipe:     { length: 1.0 },
    tee:      { },
    elbow:    { },
    radiator: { roomName: '', flowRate: '', power: '' },
  };
  return {
    id: uid(type),
    type,
    x, y,
    rotation: 0,
    props: { ...defaults[type], ...props },
  };
}

export function createEdge(fromNodeId, fromPortId, toNodeId, toPortId) {
  return {
    id: uid('e'),
    fromNodeId, fromPortId,
    toNodeId,   toPortId,
  };
}

// ─── Graph traversal utilities ────────────────────────────────────────────────

/** Returns adjacency list: nodeId -> [{edgeId, neighborId, portOut, portIn}] */
export function buildAdjacency(nodes, edges) {
  const adj = {};
  nodes.forEach(n => (adj[n.id] = []));
  edges.forEach(e => {
    if (adj[e.fromNodeId]) adj[e.fromNodeId].push({ edgeId: e.id, neighborId: e.toNodeId, portOut: e.fromPortId, portIn: e.toPortId });
    if (adj[e.toNodeId])   adj[e.toNodeId].push({ edgeId: e.id, neighborId: e.fromNodeId, portOut: e.toPortId, portIn: e.fromPortId });
  });
  return adj;
}

/** Finds all simple paths from startId to endId (radiators) using DFS */
export function findAllPathsToRadiators(nodes, edges) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adj = buildAdjacency(nodes, edges);
  const pump = nodes.find(n => n.type === 'pump');
  if (!pump) return [];

  const paths = [];

  function dfs(currentId, path, visitedNodes) {
    const node = nodeMap[currentId];
    if (!node) return;

    if (node.type === 'radiator' && path.length > 1) {
      paths.push([...path]);
      return;
    }

    for (const link of adj[currentId] || []) {
      // Only follow outward direction (from -> to edges)
      const edge = edges.find(e => e.id === link.edgeId);
      if (!edge) continue;

      // For directed traversal: only follow edges going AWAY from pump
      if (edge.toNodeId === currentId) continue; // don't go backward on edges

      if (visitedNodes.has(link.neighborId)) continue;
      visitedNodes.add(link.neighborId);
      path.push({ nodeId: link.neighborId, edgeId: link.edgeId });
      dfs(link.neighborId, path, visitedNodes);
      path.pop();
      visitedNodes.delete(link.neighborId);
    }
  }

  const visited = new Set([pump.id]);
  dfs(pump.id, [{ nodeId: pump.id, edgeId: null }], visited);
  return paths;
}

/** Get all open (unconnected) output ports */
export function getOpenOutPorts(nodes, edges) {
  const used = new Set(edges.flatMap(e => [
    `${e.fromNodeId}:${e.fromPortId}`,
    `${e.toNodeId}:${e.toPortId}`,
  ]));

  const open = [];
  nodes.forEach(node => {
    const config = NODE_PORT_CONFIG[node.type];
    if (!config) return;
    Object.entries(config).forEach(([portId, p]) => {
      if (p.type === 'out' && !used.has(`${node.id}:${portId}`)) {
        open.push({ nodeId: node.id, portId });
      }
    });
  });
  return open;
}

// ─── Port configuration (geometry + type) ────────────────────────────────────
export const NODE_PORT_CONFIG = {
  pump:     { out: { x: 30, y: 0,  type: 'out', dir: 'right' } },
  pipe:     { in:  { x: -48, y: 0, type: 'in',  dir: 'left'  },
              out: { x:  48, y: 0, type: 'out', dir: 'right' } },
  tee:      { in:     { x: -40, y:  0, type: 'in',  dir: 'left'  },
              out:    { x:  40, y:  0, type: 'out', dir: 'right' },
              branch: { x:   0, y: 36, type: 'out', dir: 'down'  } },
  elbow:    { in:  { x: -30, y:  0, type: 'in',  dir: 'left' },
              out: { x:   0, y: 30, type: 'out', dir: 'down' } },
  radiator: { in:  { x: -60, y: 0, type: 'in',  dir: 'left'  },
              out: { x:  60, y: 0, type: 'out', dir: 'right' } },
};

export const NODE_SIZE = {
  pump:     { width: 60, height: 60 },
  pipe:     { width: 96, height: 24 },
  tee:      { width: 80, height: 68 },
  elbow:    { width: 60, height: 60 },
  radiator: { width: 120, height: 50 },
};

const DEG = Math.PI / 180;
function rotatePoint(x, y, deg) {
  const r = deg * DEG;
  const cos = Math.round(Math.cos(r) * 1e9) / 1e9;
  const sin = Math.round(Math.sin(r) * 1e9) / 1e9;
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function rotateDir(dir, deg) {
  const maps = {
    0:   { right: 'right', left: 'left',  up: 'up',    down: 'down'  },
    90:  { right: 'down',  left: 'up',    up: 'right', down: 'left'  },
    180: { right: 'left',  left: 'right', up: 'down',  down: 'up'    },
    270: { right: 'up',    left: 'down',  up: 'left',  down: 'right' },
  };
  return (maps[deg] || maps[0])[dir] || dir;
}

export function getPortAbsPos(node, portId) {
  const config = NODE_PORT_CONFIG[node.type];
  if (!config) return null;
  const port = config[portId];
  if (!port) return null;
  const rot = node.rotation || 0;
  const rp = rotatePoint(port.x, port.y, rot);
  return { x: node.x + rp.x, y: node.y + rp.y, dir: rotateDir(port.dir, rot) };
}