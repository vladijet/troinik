/**
 * Hydraulic Graph Engine
 * Nodes: pump, tee, elbow, radiator (компоненты)
 * Edges: трубы — соединения между портами узлов, несут pipeProps
 */

export const WATER = {
  density: 971.8,      // kg/m³ at 80°C
  viscosity: 0.000365, // m²/s kinematic
};

export const ZETA = {
  ppr_pn20:      { tee_pass: 0.5, tee_branch: 1.5, elbow_90: 1.5, radiator: 2.5 },
  ppr_pn25:      { tee_pass: 0.5, tee_branch: 1.5, elbow_90: 1.5, radiator: 2.5 },
  metal_plastic: { tee_pass: 0.3, tee_branch: 1.3, elbow_90: 1.1, radiator: 2.0 },
  pex:           { tee_pass: 0.3, tee_branch: 1.3, elbow_90: 1.1, radiator: 2.0 },
  stainless:     { tee_pass: 0.2, tee_branch: 1.2, elbow_90: 0.9, radiator: 1.8 },
};

// ─── Port config: только компоненты (не труба) ────────────────────────────────
// Трубы теперь — это рёбра, а не узлы.
export const NODE_PORT_CONFIG = {
  pump:     { out:    { x:  28, y:   0, type: 'out', dir: 'right' } },
  tee:      { in:     { x: -28, y:   0, type: 'in',  dir: 'left'  },
              out:    { x:  28, y:   0, type: 'out', dir: 'right' },
              branch: { x:   0, y:  28, type: 'out', dir: 'down'  } },
  elbow:    { in:     { x: -28, y:   0, type: 'in',  dir: 'left'  },
              out:    { x:   0, y:  28, type: 'out', dir: 'down'  } },
  radiator: { in:     { x: -50, y:   0, type: 'in',  dir: 'left'  },
              out:    { x:  50, y:   0, type: 'out', dir: 'right' } },
};

export const NODE_SIZE = {
  pump:     { width: 56, height: 56 },
  tee:      { width: 56, height: 56 },
  elbow:    { width: 56, height: 56 },
  radiator: { width: 100, height: 40 },
};

// ─── UID generator ────────────────────────────────────────────────────────────
let _seq = 1;
export const uid   = (p = 'n') => `${p}-${_seq++}`;
export const resetUid = () => { _seq = 1; };

// ─── Factories ────────────────────────────────────────────────────────────────
export function createNode(type, x, y, props = {}) {
  const defaults = {
    pump:     {},
    tee:      {},
    elbow:    {},
    radiator: { roomName: '', flowRate: '', power: '' },
  };
  return { id: uid(type), type, x, y, rotation: 0, props: { ...defaults[type], ...props } };
}

/** Edge = труба. pipeProps несёт {length} */
export function createEdge(fromNodeId, fromPortId, toNodeId, toPortId, pipeProps = {}) {
  return {
    id: uid('pipe'),
    fromNodeId, fromPortId,
    toNodeId,   toPortId,
    pipeProps: { length: 1.0, ...pipeProps },
  };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
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

// ─── Open ports (для проверки топологии) ────────────────────────────────────
export function getOpenPorts(nodes, edges) {
  const used = new Set(edges.flatMap(e => [
    `${e.fromNodeId}:${e.fromPortId}`,
    `${e.toNodeId}:${e.toPortId}`,
  ]));
  const open = [];
  nodes.forEach(node => {
    const config = NODE_PORT_CONFIG[node.type];
    if (!config) return;
    Object.entries(config).forEach(([portId]) => {
      if (!used.has(`${node.id}:${portId}`)) {
        open.push({ nodeId: node.id, portId });
      }
    });
  });
  return open;
}

// ─── Topology validation ──────────────────────────────────────────────────────
/**
 * Возвращает { valid: bool, errors: string[], openPorts: [{nodeId,portId}] }
 * Правила:
 *  1. Нет открытых портов
 *  2. Каждая ветка заканчивается радиатором
 *  3. Есть хотя бы один радиатор
 */
export function validateTopology(nodes, edges) {
  const errors = [];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // 1. Открытые порты
  const openPorts = getOpenPorts(nodes, edges);
  if (openPorts.length > 0) {
    errors.push(`Незакрытые порты: ${openPorts.length} шт. Подключите все точки.`);
  }

  // 2. Есть насос
  const pump = nodes.find(n => n.type === 'pump');
  if (!pump) { errors.push('Насос не найден.'); return { valid: false, errors, openPorts }; }

  // 3. Хотя бы один радиатор
  const radiators = nodes.filter(n => n.type === 'radiator');
  if (radiators.length === 0) { errors.push('Добавьте хотя бы один радиатор.'); }

  // 4. BFS от насоса — проверяем что все концевые узлы (нет исходящих рёбер) = радиаторы
  if (openPorts.length === 0 && radiators.length > 0) {
    const adjOut = {};
    nodes.forEach(n => (adjOut[n.id] = []));
    edges.forEach(e => { adjOut[e.fromNodeId]?.push(e.toNodeId); });

    const visited = new Set();
    const queue = [pump.id];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const outs = adjOut[id] || [];
      if (outs.length === 0) {
        // концевой узел — должен быть радиатором
        if (nodeMap[id]?.type !== 'radiator') {
          errors.push(`Ветка заканчивается не радиатором (${id}).`);
        }
      }
      outs.forEach(nid => !visited.has(nid) && queue.push(nid));
    }
  }

  return { valid: errors.length === 0, errors, openPorts };
}