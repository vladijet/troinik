/**
 * Hydraulic Calculation Engine v5.0 — двухтрубная система
 *
 * Ключевая идея для двухтрубной (тройниковой) системы:
 * - Граф содержит ЦИКЛЫ (подача → радиатор → обратка → насос).
 * - Нельзя использовать простой BFS/DFS-дерево, т.к. он "рвёт" циклы.
 * - Правильный подход: найти путь от насоса до каждого радиатора
 *   через ветку ПОДАЧИ (не через обратку), посчитать ΔP этого пути.
 * - Насос подбирается по МАКСИМАЛЬНОМУ ΔP среди всех веток (критический путь).
 * - Расход насоса = СУММА расходов всех радиаторов.
 *
 * Алгоритм определения ветки подачи vs обратки:
 * - Запускаем BFS от насоса по ненаправленному графу.
 * - Для каждого радиатора ищем кратчайший путь от насоса.
 * - Этот путь и есть "подача" для данного радиатора.
 * - ΔP ветки = сумма потерь всех труб, тройников, углов на этом пути.
 */
import { PIPE_TYPES } from './pipeStandards';
import { WATER, ZETA } from './hydraulicGraph';

const MIN_FLOW_LPM  = 0.65;
const V_OPT_MIN     = 0.3;
const V_OPT_MAX     = 0.5;
const MAX_DP_SYSTEM = 20000; // Па (20 кПа)

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
  const d = size.inner / 1000;
  const v = flowLpm / 60000 / (Math.PI * d * d / 4);
  const re = v * d / WATER.viscosity;
  const f = frictionFactor(re, spec.roughness, size.inner);
  return f * (lengthM / d) * (WATER.density * v * v / 2);
}

function specificPressureDrop(flowLpm, size, pipeType) {
  return pipePressureDrop(flowLpm, 1, size, pipeType);
}

function localDrop(zeta, v) {
  return zeta * WATER.density * v * v / 2;
}

/**
 * BFS: находит кратчайший путь (по числу рёбер) от startId до targetId.
 * Возвращает массив рёбер [{edgeId, fromNodeId, toNodeId}] или null если пути нет.
 * Параметр excludeNodeId: узел, через который НЕ надо идти (обычно сам радиатор-target,
 * чтобы не пройти через него дважды).
 */
function bfsPath(startId, targetId, adjUndirected) {
  if (startId === targetId) return [];
  const prev = new Map(); // nodeId → {edgeId, fromNodeId}
  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const lnk of adjUndirected[cur] || []) {
      if (visited.has(lnk.nodeId)) continue;
      visited.add(lnk.nodeId);
      prev.set(lnk.nodeId, { edgeId: lnk.edgeId, fromNodeId: cur });
      if (lnk.nodeId === targetId) {
        // Восстанавливаем путь
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
  return null; // путь не найден
}

/**
 * Для каждого тройника определяем расход через него:
 * суммируем расходы всех радиаторов, чьи пути подачи проходят через этот тройник.
 */
function buildNodeFlows(pumpId, radiators, radFlow, adjUndirected) {
  const nodeFlow = {};

  for (const rad of radiators) {
    const path = bfsPath(pumpId, rad.id, adjUndirected);
    if (!path) continue;
    const q = radFlow[rad.id] || 0;
    for (const seg of path) {
      // Добавляем расход радиатора к каждому промежуточному узлу
      nodeFlow[seg.fromNodeId] = (nodeFlow[seg.fromNodeId] || 0) + q;
      nodeFlow[seg.toNodeId]   = (nodeFlow[seg.toNodeId]   || 0) + q;
    }
  }

  return nodeFlow;
}

/**
 * Строим edgeFlow: для каждого ребра — суммарный расход радиаторов,
 * чьи пути ПОДАЧИ проходят через это ребро.
 * Это правильный подход для двухтрубной системы:
 * ближние к насосу участки несут суммарный расход всех "дальних" радиаторов.
 */
function buildEdgeFlows(pumpId, radiators, radFlow, adjUndirected) {
  const edgeFlow = {};

  for (const rad of radiators) {
    const path = bfsPath(pumpId, rad.id, adjUndirected);
    if (!path) continue;
    const q = radFlow[rad.id] || 0;
    for (const seg of path) {
      edgeFlow[seg.edgeId] = (edgeFlow[seg.edgeId] || 0) + q;
    }
  }

  return edgeFlow;
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

  // ── 4. Расходы по рёбрам и узлам (двухтрубная логика) ─────────────────────
  // edgeFlow: для каждого ребра суммируем расходы всех радиаторов,
  // чьи кратчайшие пути от насоса проходят через это ребро.
  const edgeFlow = buildEdgeFlows(pump.id, radiators, radFlow, adjUndirected);
  const nodeFlow = buildNodeFlows(pump.id, radiators, radFlow, adjUndirected);

  // Для рёбер, не попавших ни в один путь подачи (рёбра обратки) —
  // используем расход узла-источника (меньшего из двух концов)
  edges.forEach(e => {
    if (!edgeFlow[e.id]) {
      // Это ребро обратки или изолированное — берём минимальный расход концов
      const flowA = nodeFlow[e.fromNodeId] || 0;
      const flowB = nodeFlow[e.toNodeId]   || 0;
      edgeFlow[e.id] = Math.max(flowA, flowB, MIN_FLOW_LPM);
    }
  });

  console.log('[HydroCalc v5] edgeFlow:', JSON.stringify(edgeFlow));
  console.log('[HydroCalc v5] nodeFlow:', JSON.stringify(nodeFlow));

  // ── 5. Расчёт диаметров и потерь ──────────────────────────────────────────
  function calcAllResults(forceMinInnerByEdge = {}) {
    const res = {};

    // Трубы
    for (const e of edges) {
      const flow = edgeFlow[e.id] || MIN_FLOW_LPM;
      const len  = parseFloat(e.pipeProps.length);
      const minInner = forceMinInnerByEdge[e.id] || 0;
      const size = selectPipeSize(flow, pipeType, minInner);
      const dp   = pipePressureDrop(flow, len, size, pipeType);
      res[e.id] = {
        flowRate: flow,
        size,
        velocity: size?.velocity || 0,
        pressureLoss: dp,
        specificDp: specificPressureDrop(flow, size, pipeType),
      };
    }

    // Тройники
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

    // Углы
    for (const n of nodes.filter(nd => nd.type === 'elbow')) {
      const flow = nodeFlow[n.id] || MIN_FLOW_LPM;
      const size = selectPipeSize(flow, pipeType);
      const v = size?.velocity || 0;
      res[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.elbow_90, v) };
    }

    // Радиаторы
    for (const n of radiators) {
      const flow = radFlow[n.id] || 0;
      const size = selectPipeSize(flow, pipeType);
      const v = size?.velocity || 0;
      res[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.radiator, v) };
    }

    return res;
  }

  // ── 6. Первый расчёт ───────────────────────────────────────────────────────
  let elementResults = calcAllResults();

  // ── 7. Критический путь: для каждого радиатора считаем ΔP пути подачи ─────
  // ΔP_ветки = сумма потерь в трубах + фитингах на пути от насоса до радиатора
  function calcBranchDp(radId) {
    const path = bfsPath(pump.id, radId, adjUndirected);
    if (!path) return 0;
    let dp = 0;
    for (const seg of path) {
      dp += elementResults[seg.edgeId]?.pressureLoss || 0;
      // Добавляем потери на промежуточных узлах (тройники, углы)
      const nd = nodes.find(n => n.id === seg.toNodeId);
      if (nd && nd.type !== 'pump' && nd.type !== 'radiator') {
        dp += elementResults[nd.id]?.pressureLoss || 0;
      }
    }
    // Добавляем потери самого радиатора
    dp += elementResults[radId]?.pressureLoss || 0;
    return dp;
  }

  let maxDp = 0;
  let criticalRadId = null;
  for (const rad of radiators) {
    const dp = calcBranchDp(rad.id);
    console.log(`[HydroCalc v5] branch ΔP для ${rad.id}: ${(dp/1000).toFixed(2)} кПа`);
    if (dp > maxDp) { maxDp = dp; criticalRadId = rad.id; }
  }

  // ── 8. Автокоррекция при ΔP > 20 кПа ─────────────────────────────────────
  const warnings = [];
  if (maxDp > MAX_DP_SYSTEM && criticalRadId) {
    warnings.push(`Сопротивление критической ветки ${(maxDp/1000).toFixed(1)} кПа > 20 кПа. Выполняется автокоррекция.`);

    const critPath = bfsPath(pump.id, criticalRadId, adjUndirected);
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
        warnings.push(`После коррекции: ${(maxDp/1000).toFixed(1)} кПа. Рекомендуется увеличить диаметры магистрали.`);
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