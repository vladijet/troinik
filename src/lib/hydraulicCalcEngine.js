/**
 * Hydraulic Calculation Engine v8.0 — двухтрубная система, одно ребро = магистраль (подача + обратка)
 *
 * Физическая модель:
 * - Каждое ребро графа = двухтрубная магистраль: подача и обратка идут параллельно.
 * - Пользователь указывает длину ОДНОЙ трубы. Движок считает её × 2.
 * - ΔP_ветки = ΔP_путь(подача, L×2) + ΔP_радиатора
 *   (путь = BFS от насоса до радиатора; каждый сегмент несёт потери подачи + обратки)
 * - Насос подбирается по МАКСИМАЛЬНОМУ ΔP среди всех веток (критический путь).
 * - Расход насоса = СУММА расходов всех радиаторов.
 *
 * Сопротивление радиатора:
 * - Радиатор с нижним подключением + встроенный термовентиль = 10 кПа (константа).
 * - Диапазон нормальной работы термоклапана: 3–30 кПа (бесшумная работа).
 */
import { PIPE_TYPES } from './pipeStandards';
import { WATER, ZETA } from './hydraulicGraph';

const MIN_FLOW_LPM  = 0.65;
const V_OPT_MIN     = 0.3;
const V_OPT_MAX     = 0.5;
const MAX_DP_SYSTEM = 30000; // Па (30 кПа) — максимум для бесшумной работы термоклапана

// Сопротивление радиатора с нижним подключением + встроенный термовентиль
// Диапазон: 5–15 кПа, проектный номинал = 10 кПа
const RADIATOR_VALVE_DP = 10000; // Па

// ─── Подбор диаметра ──────────────────────────────────────────────────────────
function selectPipeSize(flowLpm, pipeType, forceMinInner = 0) {
  const spec = PIPE_TYPES[pipeType];
  if (!spec) return null;
  const flowM3s = flowLpm / 60000;

  let optimal = null;
  let fallback = null;
  let largest  = null;

  for (const size of spec.sizes) {
    if (size.inner < forceMinInner) continue;
    const d = size.inner / 1000;
    const v = flowM3s / (Math.PI * d * d / 4);
    const enriched = { ...size, velocity: v };

    if (!largest || size.inner > largest.inner) largest = enriched;
    if (v >= V_OPT_MIN && v <= V_OPT_MAX && !optimal) optimal = enriched;
    if (v <= spec.maxVelocity && !fallback) fallback = enriched;
  }

  if (!optimal && !fallback && !largest) {
    const last = spec.sizes[spec.sizes.length - 1];
    const d = last.inner / 1000;
    return { ...last, velocity: flowM3s / (Math.PI * d * d / 4) };
  }

  return optimal || fallback || largest;
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
  if (!size || flowLpm <= 0 || lengthM <= 0) return 0;
  const spec = PIPE_TYPES[pipeType];
  const d = size.inner / 1000;           // мм → м
  const v = flowLpm / 60000 / (Math.PI * d * d / 4); // л/мин → м³/с → м/с
  const re = v * d / WATER.viscosity;
  const f = frictionFactor(re, spec.roughness, size.inner);
  const dp = f * (lengthM / d) * (WATER.density * v * v / 2);

  console.log(
    `[pipeDp] Ø${size.inner}мм Q=${flowLpm.toFixed(3)}л/мин L=${lengthM}м` +
    ` v=${v.toFixed(4)}м/с Re=${re.toFixed(0)} λ=${f.toFixed(5)} ΔP=${dp.toFixed(1)}Па`
  );

  return dp;
}

function specificPressureDrop(flowLpm, size, pipeType) {
  return pipePressureDrop(flowLpm, 1, size, pipeType);
}

function localDrop(zeta, v) {
  return zeta * WATER.density * v * v / 2;
}

/**
 * BFS: находит кратчайший путь от startId до targetId,
 * проходя ТОЛЬКО по рёбрам из разрешённого множества allowedEdgeIds.
 * blockedNodes — множество nodeId, через которые нельзя проходить транзитом
 * (используется чтобы не "проходить" через чужие радиаторы).
 * Возвращает массив [{edgeId, fromNodeId, toNodeId}] или null.
 */
function bfsPath(startId, targetId, adjUndirected, allowedEdgeIds = null, blockedNodes = null) {
  if (startId === targetId) return [];
  const prev = new Map();
  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const lnk of adjUndirected[cur] || []) {
      if (allowedEdgeIds && !allowedEdgeIds.has(lnk.edgeId)) continue;
      if (visited.has(lnk.nodeId)) continue;
      // Нельзя проходить транзитом через "заблокированный" узел,
      // но сам целевой узел — всегда разрешён
      if (blockedNodes && blockedNodes.has(lnk.nodeId) && lnk.nodeId !== targetId) continue;
      visited.add(lnk.nodeId);
      prev.set(lnk.nodeId, { edgeId: lnk.edgeId, fromNodeId: cur });
      if (lnk.nodeId === targetId) {
        const path = [];
        let node = targetId;
        while (prev.has(node)) {
          const { edgeId, fromNodeId } = prev.get(node);
          path.unshift({ edgeId, fromNodeId, toNodeId: node });
          node = fromNodeId;
        }
        return path;
      }
      queue.push(lnk.nodeId);
    }
  }
  return null;
}

/**
 * Строим направленное дерево потока от насоса обходом в ширину.
 * Возвращает:
 *   - children: Map<nodeId, [{edgeId, childId}]>  — дочерние узлы (по направлению потока)
 *   - edgeDirection: Map<edgeId, {from, to}>       — направленность каждого ребра
 */
function buildFlowTree(pumpId, adjUndirected) {
  const children = new Map();
  const edgeDirection = new Map();
  const visited = new Set([pumpId]);
  const queue = [pumpId];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!children.has(cur)) children.set(cur, []);
    for (const lnk of adjUndirected[cur] || []) {
      if (visited.has(lnk.nodeId)) continue;
      visited.add(lnk.nodeId);
      children.get(cur).push({ edgeId: lnk.edgeId, childId: lnk.nodeId });
      edgeDirection.set(lnk.edgeId, { from: cur, to: lnk.nodeId });
      queue.push(lnk.nodeId);
    }
  }
  return { children, edgeDirection };
}

/**
 * Рекурсивно суммируем расходы: каждый узел несёт сумму расходов
 * всех радиаторов в его поддереве.
 * Возвращает { edgeFlow, nodeFlow }.
 */
function buildFlowsFromTree(pumpId, children, radFlow, radiatorIds) {
  const edgeFlow = {};
  const nodeFlow = {};

  // post-order DFS: возвращает суммарный расход поддерева узла
  function dfs(nodeId) {
    let subtreeFlow = 0;

    // Если это радиатор — его поддерево = его собственный расход
    if (radiatorIds.has(nodeId)) {
      subtreeFlow = radFlow[nodeId] || 0;
    }

    // Проходим по всем дочерним рёбрам
    for (const { edgeId, childId } of (children.get(nodeId) || [])) {
      const childFlow = dfs(childId);
      // Ребро несёт ровно столько, сколько потребляет его поддерево
      edgeFlow[edgeId] = childFlow;
      subtreeFlow += childFlow;
    }

    nodeFlow[nodeId] = subtreeFlow;
    return subtreeFlow;
  }

  dfs(pumpId);
  return { edgeFlow, nodeFlow };
}

// Обёртки для обратной совместимости с остальным кодом
function buildEdgeFlows(pumpId, radiators, radFlow, adjUndirected) {
  const { children } = buildFlowTree(pumpId, adjUndirected);
  const radiatorIds = new Set(radiators.map(r => r.id));
  const { edgeFlow } = buildFlowsFromTree(pumpId, children, radFlow, radiatorIds);
  return edgeFlow;
}

function buildNodeFlows(pumpId, radiators, radFlow, adjUndirected) {
  const { children } = buildFlowTree(pumpId, adjUndirected);
  const radiatorIds = new Set(radiators.map(r => r.id));
  const { nodeFlow } = buildFlowsFromTree(pumpId, children, radFlow, radiatorIds);
  return nodeFlow;
}

export function calcHydraulicGraph(nodes, edges, globalParams) {
  const { pipeType, tSupply, tReturn } = globalParams;
  const zeta = ZETA[pipeType] || ZETA.ppr_pn20;
  const pump = nodes.find(n => n.type === 'pump');
  const radiators = nodes.filter(n => n.type === 'radiator');

  const deltaT = tSupply - tReturn;
  if (deltaT <= 0) return { error: 'Т подачи должна быть выше обратки' };

  // ── 1. Расходы радиаторов ──────────────────────────────────────────────────
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
      q = MIN_FLOW_LPM;
    }
    radFlow[rad.id] = q;
  }

  // ── 2. Проверка длин рёбер ─────────────────────────────────────────────────
  for (const e of edges) {
    const l = parseFloat(e.pipeProps?.length);
    if (!l || l <= 0) return { error: `Труба ${e.id}: укажите длину` };
  }

  // ── 3. Ненаправленный граф ─────────────────────────────────────────────────
  const adjUndirected = {};
  nodes.forEach(n => { adjUndirected[n.id] = []; });
  edges.forEach(e => {
    adjUndirected[e.fromNodeId]?.push({ edgeId: e.id, nodeId: e.toNodeId });
    adjUndirected[e.toNodeId]?.push({ edgeId: e.id, nodeId: e.fromNodeId });
  });

  // ── 4. Расходы по рёбрам и узлам ──────────────────────────────────────────
  // Используем направленное дерево от насоса — физически точный подход.
  const edgeFlow = buildEdgeFlows(pump.id, radiators, radFlow, adjUndirected);
  const nodeFlow = buildNodeFlows(pump.id, radiators, radFlow, adjUndirected);

  edges.forEach(e => {
    if (!edgeFlow[e.id]) {
      const flowA = nodeFlow[e.fromNodeId] || 0;
      const flowB = nodeFlow[e.toNodeId]   || 0;
      edgeFlow[e.id] = Math.max(flowA, flowB, MIN_FLOW_LPM);
    }
  });

  console.log('[HydroCalc v7] edgeFlow:', JSON.stringify(edgeFlow));
  console.log('[HydroCalc v7] nodeFlow:', JSON.stringify(nodeFlow));

  // ── 5. Расчёт диаметров и потерь ──────────────────────────────────────────
  // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: длина ребра × 2, т.к. каждое ребро = подача + обратка.
  function calcAllResults(forceMinInnerByEdge = {}) {
    const res = {};

    for (const e of edges) {
      const flow    = edgeFlow[e.id] || MIN_FLOW_LPM;
      const lenOne  = parseFloat(e.pipeProps.length);
      const lenDual = lenOne * 2; // подача + обратка
      const minInner = forceMinInnerByEdge[e.id] || 0;
      const size = selectPipeSize(flow, pipeType, minInner);
      const dp   = pipePressureDrop(flow, lenDual, size, pipeType);
      res[e.id] = {
        flowRate: flow,
        size,
        velocity: size?.velocity || 0,
        pressureLoss: dp,           // суммарная потеря (подача + обратка)
        pressureLossOne: pipePressureDrop(flow, lenOne, size, pipeType),
        specificDp: specificPressureDrop(flow, size, pipeType),
      };
    }

    for (const n of nodes.filter(nd => nd.type === 'tee')) {
      const flow = nodeFlow[n.id] || 0;
      const size = selectPipeSize(flow, pipeType);
      const v = size?.velocity || 0;
      res[n.id] = {
        flowRate: flow,
        size,
        pressureLossPass:   localDrop(zeta.tee_pass,   v),
        pressureLossBranch: localDrop(zeta.tee_branch, v),
        pressureLoss: localDrop(zeta.tee_pass, v),
      };
    }

    for (const n of nodes.filter(nd => nd.type === 'elbow')) {
      const flow = nodeFlow[n.id] || MIN_FLOW_LPM;
      const size = selectPipeSize(flow, pipeType);
      const v = size?.velocity || 0;
      res[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.elbow_90, v) };
    }

    for (const n of radiators) {
      const flow = radFlow[n.id] || 0;
      const size = selectPipeSize(flow, pipeType);
      const v = size?.velocity || 0;
      // Радиатор с нижним подключением + встроенный термовентиль:
      // константное сопротивление 10 кПа + динамические потери арматуры
      const dpDynamic = localDrop(zeta.radiator, v);
      const dpTotal   = RADIATOR_VALVE_DP + dpDynamic;
      res[n.id] = { flowRate: flow, size, pressureLoss: dpTotal, pressureLossDynamic: dpDynamic, pressureLossValve: RADIATOR_VALVE_DP };
    }

    return res;
  }

  // ── 6. Первый расчёт ───────────────────────────────────────────────────────
  let elementResults = calcAllResults();

  // ── 7. Критический путь ────────────────────────────────────────────────────
  // ΔP_ветки = сумма потерь рёбер (уже × 2) + фитингов + радиатора
  // Строим дерево для обхода пути от насоса до каждого радиатора
  const { children: flowChildren } = buildFlowTree(pump.id, adjUndirected);

  // Собираем путь от насоса до radId по дереву (directed DFS)
  function getPathInTree(targetId) {
    const path = [];
    function dfs(nodeId) {
      if (nodeId === targetId) return true;
      for (const { edgeId, childId } of (flowChildren.get(nodeId) || [])) {
        if (dfs(childId)) {
          path.unshift({ edgeId, fromNodeId: nodeId, toNodeId: childId });
          return true;
        }
      }
      return false;
    }
    dfs(pump.id);
    return path;
  }

  function calcBranchDp(radId) {
    const path = getPathInTree(radId);
    if (!path) return 0;
    let dp = 0;
    for (const seg of path) {
      dp += elementResults[seg.edgeId]?.pressureLoss || 0;
      const nd = nodes.find(n => n.id === seg.toNodeId);
      if (nd && nd.type !== 'pump' && nd.type !== 'radiator') {
        dp += elementResults[nd.id]?.pressureLoss || 0;
      }
    }
    dp += elementResults[radId]?.pressureLoss || 0;
    return dp;
  }

  let maxDp = 0;
  let criticalRadId = null;
  for (const rad of radiators) {
    const dp = calcBranchDp(rad.id);
    console.log(`[HydroCalc v7] branch ΔP для ${rad.id}: ${(dp/1000).toFixed(2)} кПа`);
    if (dp > maxDp) { maxDp = dp; criticalRadId = rad.id; }
  }

  // ── 8. Автокоррекция при ΔP > 20 кПа ─────────────────────────────────────
  const warnings = [];
  if (maxDp > MAX_DP_SYSTEM && criticalRadId) {
    warnings.push(`Сопротивление критической ветки ${(maxDp/1000).toFixed(1)} кПа > 30 кПа. Выполняется автокоррекция.`);

    const critPath = bfsPath(pump.id, criticalRadId, adjUndirected, null);
    const forceMinInnerByEdge = {};
    const spec = PIPE_TYPES[pipeType];

    if (critPath) {
      for (const seg of critPath) {
        const currentSize = elementResults[seg.edgeId]?.size;
        if (!currentSize) continue;
        const idx = spec.sizes.findIndex(s => s.inner === currentSize.inner);
        if (idx >= 0 && idx < spec.sizes.length - 1) {
          forceMinInnerByEdge[seg.edgeId] = spec.sizes[idx + 1].inner;
        }
      }
    }

    if (Object.keys(forceMinInnerByEdge).length > 0) {
      elementResults = calcAllResults(forceMinInnerByEdge);
      maxDp = 0;
      for (const rad of radiators) {
        const dp = calcBranchDp(rad.id);
        if (dp > maxDp) maxDp = dp;
      }
      if (maxDp > MAX_DP_SYSTEM) {
        warnings.push(`После коррекции: ${(maxDp/1000).toFixed(1)} кПа > 30 кПа. Рекомендуется увеличить диаметры магистрали.`);
      } else {
        warnings.push(`После коррекции: ${(maxDp/1000).toFixed(1)} кПа ✓`);
      }
    }
  }

  // ── 9. Насос ───────────────────────────────────────────────────────────────
  const pumpFlow = Object.values(radFlow).reduce((a, b) => a + b, 0);
  const pumpHead = maxDp / (WATER.density * 9.81);
  elementResults[pump.id] = { flowRate: pumpFlow, pressure: maxDp, head: pumpHead };

  return {
    elementResults,
    pumpFlow,
    pumpPressure: maxDp,
    pumpHead,
    warnings,
    systemDp: maxDp,
    systemDpOk: maxDp <= MAX_DP_SYSTEM,
  };
}