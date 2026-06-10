/**
 * Hydraulic Calculation Engine v6.0 — двухтрубная система с явным разделением подачи/обратки
 *
 * Физическая модель:
 * - Каждая труба имеет флаг isReturn: false = магистраль подачи, true = магистраль обратки.
 * - Пользователь явно помечает трубы как «подача» или «обратка».
 * - Для каждого радиатора находим путь по трубам ПОДАЧИ от насоса до радиатора.
 * - Затем находим путь по трубам ОБРАТКИ от радиатора обратно до насоса.
 * - ΔP_ветки = ΔP_подача_путь + ΔP_радиатора + ΔP_обратка_путь
 * - Насос подбирается по МАКСИМАЛЬНОМУ ΔP среди всех веток (критический путь).
 * - Расход насоса = СУММА расходов всех радиаторов.
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
 * BFS: находит кратчайший путь от startId до targetId,
 * проходя ТОЛЬКО по рёбрам из разрешённого множества allowedEdgeIds.
 * Возвращает массив [{edgeId, fromNodeId, toNodeId}] или null.
 */
function bfsPath(startId, targetId, adjUndirected, allowedEdgeIds = null) {
  if (startId === targetId) return [];
  const prev = new Map();
  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const lnk of adjUndirected[cur] || []) {
      // Если задан фильтр по рёбрам — пропускаем "запрещённые"
      if (allowedEdgeIds && !allowedEdgeIds.has(lnk.edgeId)) continue;
      if (visited.has(lnk.nodeId)) continue;
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
 * Строим edgeFlow по трубам подачи: для каждого ребра — суммарный расход
 * радиаторов, чьи пути проходят через это ребро.
 * allowedEdgeIds — множество id рёбер, по которым разрешено идти (подача или обратка).
 */
function buildEdgeFlows(pumpId, radiators, radFlow, adjUndirected, allowedEdgeIds) {
  const edgeFlow = {};
  for (const rad of radiators) {
    const path = bfsPath(pumpId, rad.id, adjUndirected, allowedEdgeIds);
    if (!path) continue;
    const q = radFlow[rad.id] || 0;
    for (const seg of path) {
      edgeFlow[seg.edgeId] = (edgeFlow[seg.edgeId] || 0) + q;
    }
  }
  return edgeFlow;
}

/**
 * Строим nodeFlow: для каждого узла — суммарный расход всех радиаторов,
 * чьи пути (подача + обратка) проходят через этот узел.
 */
function buildNodeFlows(pumpId, radiators, radFlow, adjUndirected, supplyEdgeIds, returnEdgeIds) {
  const nodeFlow = {};
  for (const rad of radiators) {
    const q = radFlow[rad.id] || 0;
    // Путь подачи: от насоса до радиатора
    const supplyPath = bfsPath(pumpId, rad.id, adjUndirected, supplyEdgeIds);
    if (supplyPath) {
      for (const seg of supplyPath) {
        nodeFlow[seg.fromNodeId] = (nodeFlow[seg.fromNodeId] || 0) + q;
        nodeFlow[seg.toNodeId]   = (nodeFlow[seg.toNodeId]   || 0) + q;
      }
    }
    // Путь обратки: от радиатора обратно до насоса
    const returnPath = bfsPath(rad.id, pumpId, adjUndirected, returnEdgeIds);
    if (returnPath) {
      for (const seg of returnPath) {
        nodeFlow[seg.fromNodeId] = (nodeFlow[seg.fromNodeId] || 0) + q;
        nodeFlow[seg.toNodeId]   = (nodeFlow[seg.toNodeId]   || 0) + q;
      }
    }
  }
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

  // ── 4. Разделяем трубы на подачу и обратку ────────────────────────────────
  // isReturn: true → труба обратки, false/undefined → труба подачи
  const supplyEdgeIds = new Set(edges.filter(e => !e.pipeProps?.isReturn).map(e => e.id));
  const returnEdgeIds = new Set(edges.filter(e =>  e.pipeProps?.isReturn).map(e => e.id));

  // Если пользователь не пометил ни одной обратки — fallback к старому поведению
  // (все трубы считаются подачей, что соответствует однотрубной схеме)
  const hasTwoLineModel = returnEdgeIds.size > 0;

  const effectiveSupplyIds = hasTwoLineModel ? supplyEdgeIds : null; // null = все рёбра
  const effectiveReturnIds = hasTwoLineModel ? returnEdgeIds : null;

  // ── 5. Расходы по рёбрам ──────────────────────────────────────────────────
  const edgeFlow = buildEdgeFlows(pump.id, radiators, radFlow, adjUndirected, effectiveSupplyIds);
  const nodeFlow = buildNodeFlows(pump.id, radiators, radFlow, adjUndirected, effectiveSupplyIds, effectiveReturnIds);

  // Для рёбер обратки — расход совпадает с расходом рёбер подачи у того же радиатора.
  // Заполняем edgeFlow для обраток: ищем расход через путь обратки.
  if (hasTwoLineModel) {
    const returnEdgeFlow = buildEdgeFlows(radiators[0]?.id, radiators, radFlow, adjUndirected, effectiveReturnIds);
    // Строим edgeFlow обратки для каждого радиатора
    for (const rad of radiators) {
      const returnPath = bfsPath(rad.id, pump.id, adjUndirected, effectiveReturnIds);
      if (!returnPath) continue;
      const q = radFlow[rad.id] || 0;
      for (const seg of returnPath) {
        edgeFlow[seg.edgeId] = (edgeFlow[seg.edgeId] || 0) + q;
      }
    }
  }

  // Заполняем оставшиеся рёбра минимальным расходом
  edges.forEach(e => {
    if (!edgeFlow[e.id]) {
      const flowA = nodeFlow[e.fromNodeId] || 0;
      const flowB = nodeFlow[e.toNodeId]   || 0;
      edgeFlow[e.id] = Math.max(flowA, flowB, MIN_FLOW_LPM);
    }
  });

  console.log('[HydroCalc v6] hasTwoLineModel:', hasTwoLineModel);
  console.log('[HydroCalc v6] edgeFlow:', JSON.stringify(edgeFlow));
  console.log('[HydroCalc v6] nodeFlow:', JSON.stringify(nodeFlow));

  // ── 6. Расчёт диаметров и потерь ──────────────────────────────────────────
  function calcAllResults(forceMinInnerByEdge = {}) {
    const res = {};

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
        isReturn: !!e.pipeProps?.isReturn,
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
      res[n.id] = { flowRate: flow, size, pressureLoss: localDrop(zeta.radiator, v) };
    }

    return res;
  }

  // ── 7. Первый расчёт ───────────────────────────────────────────────────────
  let elementResults = calcAllResults();

  // ── 8. Критический путь ───────────────────────────────────────────────────
  // В двухтрубной модели: ΔP_ветки = ΔP_подача + ΔP_радиатора + ΔP_обратка
  function calcBranchDp(radId) {
    let dp = 0;

    if (hasTwoLineModel) {
      // Путь подачи: насос → радиатор, только по трубам подачи
      const supplyPath = bfsPath(pump.id, radId, adjUndirected, effectiveSupplyIds);
      if (supplyPath) {
        for (const seg of supplyPath) {
          dp += elementResults[seg.edgeId]?.pressureLoss || 0;
          const nd = nodes.find(n => n.id === seg.toNodeId);
          if (nd && nd.type !== 'pump' && nd.type !== 'radiator') {
            dp += elementResults[nd.id]?.pressureLoss || 0;
          }
        }
      }
      // Потери самого радиатора
      dp += elementResults[radId]?.pressureLoss || 0;
      // Путь обратки: радиатор → насос, только по трубам обратки
      const returnPath = bfsPath(radId, pump.id, adjUndirected, effectiveReturnIds);
      if (returnPath) {
        for (const seg of returnPath) {
          dp += elementResults[seg.edgeId]?.pressureLoss || 0;
          const nd = nodes.find(n => n.id === seg.toNodeId);
          if (nd && nd.type !== 'pump' && nd.type !== 'radiator') {
            dp += elementResults[nd.id]?.pressureLoss || 0;
          }
        }
      }
    } else {
      // Fallback: однотрубная — только путь подачи
      const path = bfsPath(pump.id, radId, adjUndirected, null);
      if (path) {
        for (const seg of path) {
          dp += elementResults[seg.edgeId]?.pressureLoss || 0;
          const nd = nodes.find(n => n.id === seg.toNodeId);
          if (nd && nd.type !== 'pump' && nd.type !== 'radiator') {
            dp += elementResults[nd.id]?.pressureLoss || 0;
          }
        }
      }
      dp += elementResults[radId]?.pressureLoss || 0;
    }

    return dp;
  }

  let maxDp = 0;
  let criticalRadId = null;
  for (const rad of radiators) {
    const dp = calcBranchDp(rad.id);
    console.log(`[HydroCalc v6] branch ΔP для ${rad.id}: ${(dp/1000).toFixed(2)} кПа`);
    if (dp > maxDp) { maxDp = dp; criticalRadId = rad.id; }
  }

  // ── 9. Автокоррекция при ΔP > 20 кПа ─────────────────────────────────────
  const warnings = [];
  if (maxDp > MAX_DP_SYSTEM && criticalRadId) {
    warnings.push(`Сопротивление критической ветки ${(maxDp/1000).toFixed(1)} кПа > 20 кПа. Выполняется автокоррекция.`);

    const critSupplyPath = bfsPath(pump.id, criticalRadId, adjUndirected, effectiveSupplyIds);
    const critReturnPath = hasTwoLineModel ? bfsPath(criticalRadId, pump.id, adjUndirected, effectiveReturnIds) : null;
    const forceMinInnerByEdge = {};
    const spec = PIPE_TYPES[pipeType];

    for (const path of [critSupplyPath, critReturnPath]) {
      if (!path) continue;
      for (const seg of path) {
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

  if (!hasTwoLineModel) {
    warnings.push('Трубы обратки не помечены. Расчёт ведётся как для однотрубной схемы. Пометьте трубы обратки в инспекторе.');
  }

  // ── 10. Насос ──────────────────────────────────────────────────────────────
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
    hasTwoLineModel,
  };
}