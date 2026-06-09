import { PIPE_TYPES } from './pipeStandards';

// Physical constants for water at ~80°C
const DENSITY = 971.6;       // kg/m³
const VISCOSITY = 0.365e-6;  // m²/s kinematic viscosity
const SPECIFIC_HEAT = 4196;  // J/(kg·K)
const GRAVITY = 9.81;

// Local resistance coefficients
const XI = {
  tee_straight: 0.5,
  tee_branch: 1.5,
  elbow_90: 1.0,
};

function selectDiameter(flowM3s, pipeSpec) {
  const d_req_m = Math.sqrt(4 * flowM3s / (Math.PI * pipeSpec.maxVelocity));
  const d_req_mm = d_req_m * 1000;
  const sorted = [...pipeSpec.sizes].sort((a, b) => a.inner - b.inner);
  return sorted.find(s => s.inner >= d_req_mm) || sorted[sorted.length - 1];
}

function frictionFactor(velocity, innerD_m, roughness_mm) {
  const k = roughness_mm / 1000;
  const Re = Math.max(1, velocity * innerD_m / VISCOSITY);
  return 0.11 * Math.pow(68 / Re + k / innerD_m, 0.25);
}

function linearLoss(flowM3s, length_m, innerD_m, roughness_mm) {
  if (flowM3s <= 0 || length_m <= 0) return 0;
  const area = Math.PI * innerD_m ** 2 / 4;
  const v = flowM3s / area;
  const lambda = frictionFactor(v, innerD_m, roughness_mm);
  return lambda * (length_m / innerD_m) * DENSITY * v * v / 2;
}

function localLoss(flowM3s, innerD_m, xi) {
  if (flowM3s <= 0) return 0;
  const area = Math.PI * innerD_m ** 2 / 4;
  const v = flowM3s / area;
  return xi * DENSITY * v * v / 2;
}

export function calcSystem(elements, connections, globalParams) {
  const { pipeType, tSupply, tReturn } = globalParams;
  const pipeSpec = PIPE_TYPES[pipeType];
  if (!pipeSpec) return { error: 'Неизвестный тип трубы' };

  const deltaT = tSupply - tReturn;
  if (deltaT <= 0) return { error: 'Температура подачи должна быть выше обратки' };

  const elMap = {};
  elements.forEach(e => (elMap[e.id] = e));

  // Index outgoing connections: "elId::portId" -> conn
  const connFrom = {};
  connections.forEach(c => {
    connFrom[`${c.fromElementId}::${c.fromPortId}`] = c;
  });

  const pump = elements.find(e => e.type === 'pump');
  if (!pump) return { error: 'Насос не найден' };

  function getRadiatorFlow(el) {
    const { flowRate, power } = el.props || {};
    if (flowRate && +flowRate > 0) return +flowRate / 60000;
    if (power && +power > 0) return +power / (SPECIFIC_HEAT * DENSITY * deltaT);
    return 0;
  }

  const flowMap = {};

  // PASS 1: compute flows bottom-up
  function computeFlows(elId) {
    const el = elMap[elId];
    if (!el) return 0;
    if (el.type === 'radiator') {
      flowMap[elId] = getRadiatorFlow(el);
      return flowMap[elId];
    }
    const ports = el.type === 'tee' ? ['out', 'branch'] : ['out'];
    let total = 0;
    ports.forEach(portId => {
      const conn = connFrom[`${elId}::${portId}`];
      if (conn) total += computeFlows(conn.toElementId);
    });
    flowMap[elId] = total;
    return total;
  }

  computeFlows(pump.id);

  const resultsMap = {};

  // PASS 2: compute sizes and pressure losses top-down
  function computePressures(elId, accLoss) {
    const el = elMap[elId];
    if (!el) return;
    const flow = flowMap[elId] || 0;

    if (el.type === 'radiator') {
      resultsMap[elId] = { flowRate: flow * 60000, flowRateM3s: flow, totalPathPressure: accLoss };
      return;
    }

    let myLoss = 0;
    let teePassLoss = 0;
    let teeBranchLoss = 0;

    if (el.type === 'pump') {
      resultsMap[elId] = { flowRate: flow * 60000 };
    } else if (el.type === 'pipe') {
      const length = parseFloat(el.props?.length) || 1;
      const size = selectDiameter(flow, pipeSpec);
      const innerD = size.inner / 1000;
      const area = Math.PI * innerD ** 2 / 4;
      const velocity = flow > 0 ? flow / area : 0;
      const dp = linearLoss(flow, length, innerD, pipeSpec.roughness);
      resultsMap[elId] = { size, velocity, pressureLoss: dp, flowRate: flow * 60000 };
      myLoss = dp;
    } else if (el.type === 'tee') {
      const size = selectDiameter(flow, pipeSpec);
      const innerD = size.inner / 1000;
      teePassLoss = localLoss(flow, innerD, XI.tee_straight);
      teeBranchLoss = localLoss(flow, innerD, XI.tee_branch);
      resultsMap[elId] = { size, pressureLossPass: teePassLoss, pressureLossBranch: teeBranchLoss, flowRate: flow * 60000 };
    } else if (el.type === 'elbow') {
      const size = selectDiameter(flow, pipeSpec);
      const innerD = size.inner / 1000;
      const dp = localLoss(flow, innerD, XI.elbow_90);
      resultsMap[elId] = { size, pressureLoss: dp, flowRate: flow * 60000 };
      myLoss = dp;
    }

    const ports = el.type === 'tee' ? ['out', 'branch'] : ['out'];
    ports.forEach(portId => {
      const conn = connFrom[`${elId}::${portId}`];
      if (!conn) return;
      let branchLoss = myLoss;
      if (el.type === 'tee') {
        branchLoss = portId === 'branch' ? teeBranchLoss : teePassLoss;
      }
      computePressures(conn.toElementId, accLoss + branchLoss);
    });
  }

  computePressures(pump.id, 0);

  // Find critical circuit
  let maxPathPressure = 0;
  elements.filter(e => e.type === 'radiator').forEach(rad => {
    const res = resultsMap[rad.id];
    if (res && (res.totalPathPressure || 0) > maxPathPressure) {
      maxPathPressure = res.totalPathPressure;
    }
  });

  const totalPressure = maxPathPressure * 2; // supply + symmetric return
  const pumpHead = totalPressure / (DENSITY * GRAVITY);
  const pumpFlow = (flowMap[pump.id] || 0) * 60000;

  resultsMap[pump.id] = {
    ...resultsMap[pump.id],
    head: pumpHead,
    pressure: totalPressure,
    flowRate: pumpFlow,
  };

  return { elementResults: resultsMap, pumpHead, pumpFlow, totalPressure };
}