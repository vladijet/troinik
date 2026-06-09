/**
 * Hydraulic Calculation Engine v3.0
 * Edges = трубы (несут pipeProps.length)
 * Nodes = компоненты (pump, tee, elbow, radiator)
 */
import { PIPE_TYPES } from './pipeStandards';
import { WATER, ZETA } from './hydraulicGraph';

const MIN_FLOW_LPM = 0.65;

function selectPipeSize(flowLpm, pipeType) {
  const spec = PIPE_TYPES[pipeType];
  if (!spec) return null;
  const flowM3s = flowLpm / 60000;
  for (const size of spec.sizes) {
    const d = size.inner / 1000;
    const v = flowM3s / (Math.PI * d * d / 4);
    if (v <= spec.maxVelocity) return { ...size, velocity: v };
  }
  const last = spec.sizes[spec.sizes.length - 1];
  const d = last.inner / 1000;
  return { ...last, velocity: flowM3s / (Math.PI * d * d / 4) };
}

function frictionFactor(re, roughnessMm, innerMm) {
  if (re < 2300) return 64 / re;
  const relRough = roughnessMm / innerMm;
  let f = 0.02;
  for (let i = 0; i < 30; i++) {
    f = 1 / (-2 * Math.log10(relRough / 3.7 + 2.51 / (re * Math.sqrt(f)))) ** 2;
  }
  return f;
}

function pipePressureDrop(flowLpm, lengthM, size, pipeType) {
  if (!size || flowLpm <= 0) return 0;
  const spec = PIPE_TYPES[pipeType];
  const d = size.inner / 1000;
  const v = flowLpm / 60000 / (Math.PI * d * d / 4);
  const re = v * d / WATER.viscosity;
  const f = frictionFactor(re, spec.roughness, size.inner);
  return f * (lengthM / d) * (WATER.density * v * v / 2);
}

function localDrop(zeta, v) {
  return zeta * WATER.density * v * v / 2;
}

export function calcHydraulicGraph(nodes, edges, globalParams) {
  const { pipeType, tSupply, tReturn } = globalParams;
  const zeta = ZETA[pipeType] || ZETA.ppr_pn20;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const pump = nodes.find(n => n.type === 'pump');
  const radiators = nodes.filter(n => n.type === 'radiator');

  const deltaT = tSupply - tReturn;
  if (deltaT <= 0) return { error: 'Т подачи должна быть выше обратки' };

  // Расход каждого радиатора
  const radFlow = {};
  for (const rad of radiators) {
    const { flowRate, power } = rad.props || {};
    let q = 0;
    if (flowRate && parseFloat(flowRate) > 0) {
      q = Math.max(MIN_FLOW_LPM, parseFloat(flowRate));
    } else if (power && parseFloat(power) > 0) {
      q = parseFloat(power) / (WATER.density * 4186 * deltaT / 60000);
      q = Math.max(MIN_FLOW_LPM, q);
    } else {
      return { error: `Радиатор "${rad.props?.roomName || rad.id}": укажите расход или мощность` };
    }
    radFlow[rad.id] = q;
  }

  // Проверка длин труб (рёбер)
  for (const e of edges) {
    const l = parseFloat(e.pipeProps?.length);
    if (!l || l <= 0) return { error: `Труба ${e.id}: укажите длину` };
  }

  // Направленный граф
  const adjOut = {};
  const adjIn  = {};
  nodes.forEach(n => { adjOut[n.id] = []; adjIn[n.id] = []; });
  edges.forEach(e => {
    adjOut[e.fromNodeId]?.push({ edgeId: e.id, nodeId: e.toNodeId });
    adjIn[e.toNodeId]?.push({ edgeId: e.id, nodeId: e.fromNodeId });
  });

  // Топологическая сортировка → расчёт расходов снизу вверх
  const inDeg = {};
  nodes.forEach(n => (inDeg[n.id] = adjIn[n.id].length));
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const topo = [];
  const vis = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (vis.has(id)) continue;
    vis.add(id); topo.push(id);
    adjOut[id].forEach(l => { if (--inDeg[l.nodeId] === 0) queue.push(l.nodeId); });
  }

  // Поток через каждый узел
  const nodeFlow = {};
  nodes.forEach(n => (nodeFlow[n.id] = radFlow[n.id] || 0));
  for (const id of [...topo].reverse()) {
    const flow = nodeFlow[id];
    if (flow > 0) adjIn[id].forEach(l => { nodeFlow[l.nodeId] = (nodeFlow[l.nodeId] || 0) + flow; });
  }

  // Поток через каждое ребро = поток нижестоящего узла
  const edgeFlow = {};
  edges.forEach(e => (edgeFlow[e.id] = nodeFlow[e.toNodeId] || 0));

  // Результаты для каждого узла и ребра
  const elementResults = {};

  // Рёбра (трубы)
  for (const e of edges) {
    const flow = edgeFlow[e.id];
    const len  = parseFloat(e.pipeProps.length);
    const size = selectPipeSize(flow, pipeType);
    const dp   = pipePressureDrop(flow, len, size, pipeType);
    elementResults[e.id] = { flowRate: flow, size, velocity: size?.velocity || 0, pressureLoss: dp };
  }

  // Тройники
  for (const n of nodes.filter(n => n.type === 'tee')) {
    const outE    = edges.find(e => e.fromNodeId === n.id && e.fromPortId === 'out');
    const branchE = edges.find(e => e.fromNodeId === n.id && e.fromPortId === 'branch');
    const fPass   = outE    ? (edgeFlow[outE.id]    || 0) : 0;
    const fBranch = branchE ? (edgeFlow[branchE.id] || 0) : 0;
    const total   = fPass + fBranch;
    const size = selectPipeSize(total, pipeType);
    const v = size?.velocity || 0;
    elementResults[n.id] = { flowRate: total, size,
      pressureLossPass:   localDrop(zeta.tee_pass,   v),
      pressureLossBranch: localDrop(zeta.tee_branch, v),
    };
  }

  // Углы
  for (const n of nodes.filter(n => n.type === 'elbow')) {
    const flow = nodeFlow[n.id] || 0;
    const size = selectPipeSize(flow, pipeType);
    const v = size?.velocity || 0;
    elementResults[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.elbow_90, v) };
  }

  // Радиаторы
  for (const n of radiators) {
    const flow = radFlow[n.id] || 0;
    const size = selectPipeSize(flow, pipeType);
    const v = size?.velocity || 0;
    elementResults[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.radiator, v) };
  }

  // Критический путь насос→радиатор (BFS с накоплением ΔP)
  let maxDp = 0;
  for (const rad of radiators) {
    const bfsQ = [{ id: pump.id, dp: 0 }];
    const bfsVis = new Set([pump.id]);
    while (bfsQ.length) {
      const { id, dp } = bfsQ.shift();
      if (id === rad.id) { if (dp > maxDp) maxDp = dp; break; }
      for (const lnk of adjOut[id] || []) {
        if (bfsVis.has(lnk.nodeId)) continue;
        bfsVis.add(lnk.nodeId);
        const edgeRes = elementResults[lnk.edgeId] || {};
        const nodeRes = elementResults[lnk.nodeId] || {};
        const addDp = (edgeRes.pressureLoss || 0) + (nodeRes.pressureLoss || nodeRes.pressureLossPass || 0);
        bfsQ.push({ id: lnk.nodeId, dp: dp + addDp });
      }
    }
  }

  const pumpFlow = Object.values(radFlow).reduce((a, b) => a + b, 0);
  const pumpHead = maxDp / (WATER.density * 9.81);
  elementResults[pump.id] = { flowRate: pumpFlow, pressure: maxDp, head: pumpHead };

  return { elementResults, pumpFlow, pumpPressure: maxDp, pumpHead };
}