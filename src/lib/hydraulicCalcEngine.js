/**
 * Hydraulic Calculation Engine v2.0
 * Graph-based: iterates nodes/edges, applies Darcy-Weisbach + tabular ζ coefficients
 * Fluid: water only
 */

import { PIPE_TYPES } from './pipeStandards';
import { WATER, ZETA } from './hydraulicGraph';

const MIN_FLOW_LPM = 0.65; // minimum radiator flow l/min

// ─── Pipe sizing ──────────────────────────────────────────────────────────────
function selectPipeSize(flowLpm, pipeType) {
  const spec = PIPE_TYPES[pipeType];
  if (!spec) return null;
  const flowM3s = flowLpm / 60000;
  for (const size of spec.sizes) {
    const d = size.inner / 1000;
    const area = Math.PI * d * d / 4;
    const v = flowM3s / area;
    if (v <= spec.maxVelocity) return { ...size, velocity: v };
  }
  const last = spec.sizes[spec.sizes.length - 1];
  const d = last.inner / 1000;
  const area = Math.PI * d * d / 4;
  return { ...last, velocity: flowM3s / area };
}

// ─── Darcy-Weisbach friction factor (Colebrook-White, iterative) ──────────────
function frictionFactor(re, roughnessMm, innerMm) {
  if (re < 2300) return 64 / re; // laminar
  const relRough = (roughnessMm / 1000) / (innerMm / 1000);
  let f = 0.02;
  for (let i = 0; i < 30; i++) {
    const rhs = -2 * Math.log10(relRough / 3.7 + 2.51 / (re * Math.sqrt(f)));
    f = 1 / (rhs * rhs);
  }
  return f;
}

// ─── Pressure drop on a pipe segment (Pa) ────────────────────────────────────
function calcPipePressureDrop(flowLpm, lengthM, size, pipeType) {
  if (!size || flowLpm <= 0) return { pressureLoss: 0, velocity: 0 };
  const spec = PIPE_TYPES[pipeType];
  const flowM3s = flowLpm / 60000;
  const d = size.inner / 1000;
  const area = Math.PI * d * d / 4;
  const v = flowM3s / area;
  const re = v * d / WATER.viscosity;
  const f = frictionFactor(re, spec.roughness, size.inner);
  const pressureLoss = f * (lengthM / d) * (WATER.density * v * v / 2);
  return { pressureLoss, velocity: v, re };
}

// ─── Local resistance pressure drop (Pa) ─────────────────────────────────────
function calcLocalPressureDrop(zeta, velocity) {
  return zeta * WATER.density * velocity * velocity / 2;
}

// ─── Main calculation function ────────────────────────────────────────────────
export function calcHydraulicGraph(nodes, edges, globalParams) {
  const { pipeType, tSupply, tReturn } = globalParams;
  const zeta = ZETA[pipeType] || ZETA.ppr_pn20;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // 1. Collect radiator demands
  const radiators = nodes.filter(n => n.type === 'radiator');
  if (radiators.length === 0) return { error: 'Добавьте хотя бы один радиатор' };

  const deltaT = tSupply - tReturn;
  if (deltaT <= 0) return { error: 'Температура подачи должна быть выше температуры обратки' };

  // Flow for each radiator (l/min)
  const radiatorFlows = {};
  for (const rad of radiators) {
    const { flowRate, power } = rad.props || {};
    let q = 0;
    if (flowRate && parseFloat(flowRate) > 0) {
      q = Math.max(MIN_FLOW_LPM, parseFloat(flowRate));
    } else if (power && parseFloat(power) > 0) {
      // Q (l/min) = P(W) / (4186 * ρ * ΔT / 60000)
      // simplified: Q = P / (70 * deltaT) in l/min
      q = parseFloat(power) / (WATER.density * 4186 * deltaT / 60000);
      q = Math.max(MIN_FLOW_LPM, q);
    } else {
      return { error: `Радиатор "${rad.props?.roomName || rad.id}": укажите расход или мощность` };
    }
    radiatorFlows[rad.id] = q;
  }

  // 2. Validate all pipes have length
  const pipes = nodes.filter(n => n.type === 'pipe');
  for (const pipe of pipes) {
    if (!pipe.props?.length || parseFloat(pipe.props.length) <= 0) {
      return { error: `Труба ${pipe.id}: укажите длину` };
    }
  }

  // 3. Build edge flow by traversal from pump
  //    Strategy: DFS from pump, accumulate flows from radiators downstream
  const pump = nodes.find(n => n.type === 'pump');
  if (!pump) return { error: 'Насос не найден в схеме' };

  // Build directed adjacency: fromNodeId -> [{ edgeId, toNodeId }]
  const adjOut = {};
  const adjIn  = {};
  nodes.forEach(n => { adjOut[n.id] = []; adjIn[n.id] = []; });
  edges.forEach(e => {
    adjOut[e.fromNodeId]?.push({ edgeId: e.id, nodeId: e.toNodeId });
    adjIn[e.toNodeId]?.push({ edgeId: e.id, nodeId: e.fromNodeId });
  });

  // Topological sort (Kahn's algorithm) to propagate flows bottom-up
  const inDegree = {};
  nodes.forEach(n => (inDegree[n.id] = adjIn[n.id].length));
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const topoOrder = [];
  const visited = new Set();

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    topoOrder.push(id);
    for (const link of adjOut[id] || []) {
      inDegree[link.nodeId]--;
      if (inDegree[link.nodeId] === 0) queue.push(link.nodeId);
    }
  }

  // Bottom-up flow accumulation
  const nodeFlow = {};
  nodes.forEach(n => {
    nodeFlow[n.id] = radiatorFlows[n.id] || 0;
  });

  // Reverse topo order: leaves first
  for (const nodeId of [...topoOrder].reverse()) {
    const node = nodeMap[nodeId];
    if (!node) continue;
    // Sum flows from all downstream nodes into this node
    for (const link of adjIn[nodeId] || []) {
      // Don't propagate through this path; we propagate upward below
    }
    // Push own flow to upstream
    const flow = nodeFlow[nodeId];
    if (flow > 0) {
      for (const link of adjIn[nodeId] || []) {
        nodeFlow[link.nodeId] = (nodeFlow[link.nodeId] || 0) + flow;
      }
    }
  }

  // Edge flows: flow through edge = flow of downstream node
  const edgeFlow = {};
  edges.forEach(e => {
    edgeFlow[e.id] = nodeFlow[e.toNodeId] || 0;
  });

  // 4. Calculate pressure drops for each element
  const elementResults = {};

  // Pipes
  for (const pipe of pipes) {
    const flow = edgeFlow[edges.find(e => e.fromNodeId === pipe.id || e.toNodeId === pipe.id)?.id] || nodeFlow[pipe.id] || 0;
    const length = parseFloat(pipe.props.length);
    const size = selectPipeSize(flow, pipeType);
    const { pressureLoss, velocity } = calcPipePressureDrop(flow, length, size, pipeType);
    elementResults[pipe.id] = { flowRate: flow, size, velocity, pressureLoss };
  }

  // Tees
  for (const tee of nodes.filter(n => n.type === 'tee')) {
    const outEdge   = edges.find(e => e.fromNodeId === tee.id && e.fromPortId === 'out');
    const branchEdge = edges.find(e => e.fromNodeId === tee.id && e.fromPortId === 'branch');
    const flowPass   = outEdge   ? (edgeFlow[outEdge.id]   || 0) : 0;
    const flowBranch = branchEdge ? (edgeFlow[branchEdge.id] || 0) : 0;
    const totalFlow  = flowPass + flowBranch;
    const size = selectPipeSize(totalFlow, pipeType);
    const v = size?.velocity || 0;
    elementResults[tee.id] = {
      flowRate: totalFlow,
      size,
      pressureLossPass:   calcLocalPressureDrop(zeta.tee_pass,   v),
      pressureLossBranch: calcLocalPressureDrop(zeta.tee_branch, v),
    };
  }

  // Elbows
  for (const elbow of nodes.filter(n => n.type === 'elbow')) {
    const flow = nodeFlow[elbow.id] || 0;
    const size = selectPipeSize(flow, pipeType);
    const v = size?.velocity || 0;
    elementResults[elbow.id] = {
      flowRate: flow,
      size,
      pressureLoss: calcLocalPressureDrop(zeta.elbow_90, v),
    };
  }

  // Radiators
  for (const rad of radiators) {
    const flow = radiatorFlows[rad.id] || 0;
    const size = selectPipeSize(flow, pipeType);
    const v = size?.velocity || 0;
    elementResults[rad.id] = {
      flowRate: flow,
      size,
      pressureLoss: calcLocalPressureDrop(zeta.radiator, v),
    };
  }

  // 5. Find critical (max pressure loss) path from pump to each radiator
  //    Critical path = path with max sum of ΔP
  function sumPathPressure(path) {
    let total = 0;
    for (const step of path) {
      const res = elementResults[step.nodeId];
      if (!res) continue;
      const node = nodeMap[step.nodeId];
      if (!node) continue;
      if (node.type === 'pipe')     total += res.pressureLoss || 0;
      if (node.type === 'elbow')    total += res.pressureLoss || 0;
      if (node.type === 'radiator') total += res.pressureLoss || 0;
      if (node.type === 'tee')      total += res.pressureLossPass || res.pressureLossBranch || 0;
    }
    return total;
  }

  // Simple BFS path finding for pump -> radiators
  let maxPathPressure = 0;
  let totalPumpFlow = 0;

  for (const rad of radiators) {
    totalPumpFlow += radiatorFlows[rad.id] || 0;
    // BFS path
    const bfsQueue = [[pump.id]];
    const bfsVisited = new Set([pump.id]);
    let found = false;
    while (bfsQueue.length > 0 && !found) {
      const pathIds = bfsQueue.shift();
      const current = pathIds[pathIds.length - 1];
      if (current === rad.id) {
        const pathSteps = pathIds.map(id => ({ nodeId: id }));
        const dp = sumPathPressure(pathSteps);
        if (dp > maxPathPressure) maxPathPressure = dp;
        found = true;
        break;
      }
      for (const link of adjOut[current] || []) {
        if (!bfsVisited.has(link.nodeId)) {
          bfsVisited.add(link.nodeId);
          bfsQueue.push([...pathIds, link.nodeId]);
        }
      }
    }
  }

  const pumpFlow = totalPumpFlow;
  const pumpPressure = maxPathPressure;
  const pumpHead = pumpPressure / (WATER.density * 9.81);

  elementResults[pump.id] = {
    flowRate: pumpFlow,
    pressure: pumpPressure,
    head: pumpHead,
  };

  return { elementResults, pumpFlow, pumpPressure, pumpHead };
}