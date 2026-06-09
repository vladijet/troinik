// Port directions and positions are defined for rotation=0
// getPortAbsPos handles rotation

const DEG = Math.PI / 180;

function rotatePoint(x, y, deg) {
  const r = deg * DEG;
  const cos = Math.round(Math.cos(r) * 1e9) / 1e9;
  const sin = Math.round(Math.sin(r) * 1e9) / 1e9;
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function rotateDir(dir, deg) {
  const map0   = { right: 'right', left: 'left',  up: 'up',    down: 'down'  };
  const map90  = { right: 'down',  left: 'up',    up: 'right', down: 'left'  };
  const map180 = { right: 'left',  left: 'right', up: 'down',  down: 'up'    };
  const map270 = { right: 'up',    left: 'down',  up: 'left',  down: 'right' };
  const maps = { 0: map0, 90: map90, 180: map180, 270: map270 };
  return (maps[deg] || map0)[dir] || dir;
}

export const ELEMENT_TYPES = {
  pump: {
    label: 'Насос',
    width: 60, height: 60,
    ports: {
      out: { x: 30, y: 0, type: 'out', dir: 'right' },
    },
    defaultProps: {},
  },
  pipe: {
    label: 'Труба',
    width: 96, height: 24,
    ports: {
      in:  { x: -48, y: 0, type: 'in',  dir: 'left' },
      out: { x:  48, y: 0, type: 'out', dir: 'right' },
    },
    defaultProps: { length: 1 },
  },
  tee: {
    label: 'Тройник',
    width: 80, height: 68,
    ports: {
      in:     { x: -40, y:  0, type: 'in',  dir: 'left' },
      out:    { x:  40, y:  0, type: 'out', dir: 'right' },
      branch: { x:   0, y: 36, type: 'out', dir: 'down' },
    },
    defaultProps: {},
  },
  elbow: {
    label: 'Угол 90°',
    width: 60, height: 60,
    ports: {
      in:  { x: -30, y:  0, type: 'in',  dir: 'left' },
      out: { x:   0, y: 30, type: 'out', dir: 'down' },
    },
    defaultProps: {},
  },
  radiator: {
    label: 'Радиатор',
    width: 120, height: 50,
    ports: {
      in:  { x: -60, y: 0, type: 'in',  dir: 'left' },
      out: { x:  60, y: 0, type: 'out', dir: 'right' },
    },
    defaultProps: { roomName: '', flowRate: '', power: '' },
  },
};

export function getPortAbsPos(element, portId) {
  const config = ELEMENT_TYPES[element.type];
  if (!config) return null;
  const port = config.ports[portId];
  if (!port) return null;
  const rot = element.rotation || 0;
  const rp = rotatePoint(port.x, port.y, rot);
  return {
    x: element.x + rp.x,
    y: element.y + rp.y,
    dir: rotateDir(port.dir, rot),
  };
}

export function getOpenOutPorts(elements, connections) {
  const used = new Set(connections.flatMap(c => [
    `${c.fromElementId}:${c.fromPortId}`,
    `${c.toElementId}:${c.toPortId}`,
  ]));
  const open = [];
  elements.forEach(el => {
    const config = ELEMENT_TYPES[el.type];
    if (!config) return;
    Object.entries(config.ports).forEach(([portId, p]) => {
      if (p.type === 'out' && !used.has(`${el.id}:${portId}`)) {
        open.push({ elementId: el.id, portId, el, portConfig: p });
      }
    });
  });
  return open;
}