/**
 * Hydraulic Calculation Engine v4.0
 * Edges = трубы (несут pipeProps.length)
 * Nodes = компоненты (pump, tee, elbow, radiator)
 *
 * Критерии подбора диаметра:
 *  1. Оптимальная скорость: 0.3 – 0.5 м/с
 *  2. Если не укладывается: допустимый диапазон до maxVelocity
 *  3. Автокоррекция: если суммарные потери на критическом пути > 20 кПа,
 *     повторный проход с увеличением диаметров на "узких" участках
 */
import { PIPE_TYPES } from './pipeStandards';
import { WATER, ZETA } from './hydraulicGraph';

const MIN_FLOW_LPM   = 0.65;
const V_OPT_MIN      = 0.3;   // м/с — нижний предел оптимальной скорости
const V_OPT_MAX      = 0.5;   // м/с — верхний предел оптимальной скорости
const MAX_DP_SYSTEM  = 20000; // Па — максимальное допустимое сопротивление сети (20 кПа)

/**
 * Подбор диаметра трубы по расходу и длине участка.
 * Приоритет: скорость в диапазоне [0.3, 0.5] м/с.
 * Если ни один размер не попадает в диапазон:
 *   - все слишком быстрые → берём максимальный диаметр
 *   - все слишком медленные → берём минимальный диаметр
 * @param {number} flowLpm  - расход, л/мин
 * @param {string} pipeType - тип трубы
 * @param {number} [forceMinInner] - принудительный минимальный внутренний диаметр (мм)
 */
function selectPipeSize(flowLpm, pipeType, forceMinInner = 0) {
  const spec = PIPE_TYPES[pipeType];
  if (!spec) return null;
  const flowM3s = flowLpm / 60000;

  let optimal = null;   // первый размер, где v ∈ [0.3, 0.5]
  let fallback = null;  // первый размер, где v ≤ maxVelocity
  let largest  = null;  // самый большой доступный (если всё равно быстро)

  for (const size of spec.sizes) {
    const d = size.inner / 1000;
    const v = flowM3s / (Math.PI * d * d / 4);
    const enriched = { ...size, velocity: v };

    // Учёт принудительного минимального диаметра
    if (size.inner < forceMinInner) continue;

    if (!largest || size.inner > largest.inner) largest = enriched;

    if (v >= V_OPT_MIN && v <= V_OPT_MAX && !optimal) {
      optimal = enriched;
    }
    if (v <= spec.maxVelocity && !fallback) {
      fallback = enriched;
    }
  }

  // Если принудительный минимум "отрезал" все размеры — берём наибольший
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

/** Удельные потери давления Па/м для данного участка */
function specificPressureDrop(flowLpm, size, pipeType) {
  return pipePressureDrop(flowLpm, 1, size, pipeType);
}

function localDrop(zeta, v) {
  return zeta * WATER.density * v * v / 2;
}

/** DFS-обход дерева от корня (насос) вниз для суммирования расходов снизу вверх */
function buildFlowsByDFS(pumpId, adjOut, radFlow, nodeIds) {
  const nodeFlow = {};
  nodeIds.forEach(id => (nodeFlow[id] = radFlow[id] || 0));

  // Рекурсивный DFS: возвращает суммарный расход через узел
  function dfs(id, visited) {
    if (visited.has(id)) return nodeFlow[id] || 0;
    visited.add(id);
    const children = adjOut[id] || [];
    for (const lnk of children) {
      const childFlow = dfs(lnk.nodeId, visited);
      nodeFlow[id] = (nodeFlow[id] || 0) + childFlow;
    }
    return nodeFlow[id] || 0;
  }

  dfs(pumpId, new Set());
  return nodeFlow;
}

/** Найти критический путь от насоса до любого радиатора (максимальный суммарный ΔP) */
function findCriticalPathDp(pump, radiators, adjOut, elementResults) {
  let maxDp = 0;
  let criticalPath = [];

  for (const rad of radiators) {
    // DFS с накоплением ΔP
    function dfsPath(id, dp, path) {
      if (id === rad.id) {
        if (dp > maxDp) { maxDp = dp; criticalPath = [...path, id]; }
        return;
      }
      for (const lnk of adjOut[id] || []) {
        const edgeRes = elementResults[lnk.edgeId] || {};
        const nodeRes = elementResults[lnk.nodeId] || {};
        const addDp = (edgeRes.pressureLoss || 0)
          + (nodeRes.pressureLoss || nodeRes.pressureLossPass || 0);
        dfsPath(lnk.nodeId, dp + addDp, [...path, id]);
      }
    }
    dfsPath(pump.id, 0, []);
  }

  return { maxDp, criticalPath };
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

  // ── 3. Направленный граф ───────────────────────────────────────────────────
  const adjOut = {};
  const adjIn  = {};
  nodes.forEach(n => { adjOut[n.id] = []; adjIn[n.id] = []; });
  edges.forEach(e => {
    adjOut[e.fromNodeId]?.push({ edgeId: e.id, nodeId: e.toNodeId });
    adjIn[e.toNodeId]?.push({ edgeId: e.id, nodeId: e.fromNodeId });
  });

  // ── 4. Суммирование расходов через DFS (от насоса вниз) ────────────────────
  const nodeFlow = buildFlowsByDFS(pump.id, adjOut, radFlow, nodes.map(n => n.id));

  console.log('[HydroCalc] adjOut:', JSON.stringify(adjOut));
  console.log('[HydroCalc] radFlow:', JSON.stringify(radFlow));
  console.log('[HydroCalc] nodeFlow after DFS:', JSON.stringify(nodeFlow));

  // Поток через каждое ребро = поток узла-потребителя (to)
  const edgeFlow = {};
  edges.forEach(e => {
    const flow = nodeFlow[e.toNodeId] || 0;
    edgeFlow[e.id] = flow;
    console.log(`[HydroCalc] edge ${e.id}: from=${e.fromNodeId}(port:${e.fromPortId}) → to=${e.toNodeId}(port:${e.toPortId}), flow=${flow} л/мин`);
  });

  // ── 5. Первый проход: подбор диаметров и потерь ────────────────────────────
  function calcAllResults(forceMinInnerByEdge = {}) {
    const res = {};

    // Рёбра (трубы)
    for (const e of edges) {
      const flow = edgeFlow[e.id];
      const len  = parseFloat(e.pipeProps.length);
      const minInner = forceMinInnerByEdge[e.id] || 0;
      const size = selectPipeSize(flow, pipeType, minInner);
      console.log(`[HydroCalc] selectPipeSize edge ${e.id}: flow=${flow} л/мин → size=`, size ? `Ø${size.outer}×${size.wall} (inner=${size.inner}mm), v=${size.velocity?.toFixed(3)}м/с` : 'null');
      const dp   = pipePressureDrop(flow, len, size, pipeType);
      res[e.id] = {
        flowRate: flow,
        size,
        velocity: size?.velocity || 0,
        pressureLoss: dp,
        specificDp: specificPressureDrop(flow, size, pipeType),
      };
    }

    // Тройники: магистраль = max(selectPipeSize(total), диаметры отводов)
    for (const n of nodes.filter(n => n.type === 'tee')) {
      const outE    = edges.find(e => e.fromNodeId === n.id && e.fromPortId === 'out');
      const branchE = edges.find(e => e.fromNodeId === n.id && e.fromPortId === 'branch');
      const fPass   = outE    ? (edgeFlow[outE.id]    || 0) : 0;
      const fBranch = branchE ? (edgeFlow[branchE.id] || 0) : 0;
      const total   = fPass + fBranch;

      // Подбираем диаметр по суммарному расходу
      let bestSize = selectPipeSize(total, pipeType);

      // Инженерное ограничение: магистраль >= диаметров отводов
      const outSize    = res[outE?.id]?.size;
      const branchSize = res[branchE?.id]?.size;
      const minOuterInner = Math.max(
        outSize?.inner    || 0,
        branchSize?.inner || 0,
      );
      if (bestSize && bestSize.inner < minOuterInner) {
        bestSize = selectPipeSize(total, pipeType, minOuterInner);
      }

      const v = bestSize?.velocity || 0;
      res[n.id] = {
        flowRate: total,
        size: bestSize,
        pressureLossPass:   localDrop(zeta.tee_pass,   v),
        pressureLossBranch: localDrop(zeta.tee_branch, v),
        pressureLoss: localDrop(zeta.tee_pass, v), // для накопления в критическом пути
      };
    }

    // Углы
    for (const n of nodes.filter(n => n.type === 'elbow')) {
      const flow = nodeFlow[n.id] || 0;
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
  let { maxDp, criticalPath } = findCriticalPathDp(pump, radiators, adjOut, elementResults);

  // ── 7. Автокоррекция: если ΔP > 20 кПа — увеличиваем диаметры на критическом пути ──
  const warnings = [];
  if (maxDp > MAX_DP_SYSTEM) {
    warnings.push(`Сопротивление сети ${(maxDp / 1000).toFixed(1)} кПа превышает 20 кПа. Выполняется автокоррекция диаметров.`);

    // Для каждого ребра критического пути ищем следующий диаметр вверх
    const forceMinInnerByEdge = {};
    const spec = PIPE_TYPES[pipeType];

    for (const nodeId of criticalPath) {
      // Ищем ребро, ведущее к этому узлу (входящее)
      const inEdge = edges.find(e => e.toNodeId === nodeId);
      if (!inEdge) continue;
      const currentSize = elementResults[inEdge.id]?.size;
      if (!currentSize) continue;

      // Ищем следующий диаметр вверх в таблице
      const idx = spec.sizes.findIndex(s => s.inner === currentSize.inner);
      if (idx >= 0 && idx < spec.sizes.length - 1) {
        forceMinInnerByEdge[inEdge.id] = spec.sizes[idx + 1].inner;
      }
    }

    // Пересчёт с увеличенными диаметрами
    if (Object.keys(forceMinInnerByEdge).length > 0) {
      elementResults = calcAllResults(forceMinInnerByEdge);
      const recalc = findCriticalPathDp(pump, radiators, adjOut, elementResults);
      maxDp = recalc.maxDp;

      if (maxDp > MAX_DP_SYSTEM) {
        warnings.push(`После коррекции: ${(maxDp / 1000).toFixed(1)} кПа. Рекомендуется увеличить диаметры магистрали вручную.`);
      } else {
        warnings.push(`После коррекции сопротивление: ${(maxDp / 1000).toFixed(1)} кПа ✓`);
      }
    }
  }

  // ── 8. Насос ───────────────────────────────────────────────────────────────
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