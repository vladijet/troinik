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
    width: 90, height: 24,
    ports: {
      in:  { x: -45, y: 0, type: 'in',  dir: 'left' },
      out: { x:  45, y: 0, type: 'out', dir: 'right' },
    },
    defaultProps: { length: 1 },
  },
  tee: {
    label: 'Тройник',
    width: 80, height: 65,
    ports: {
      in:     { x: -40, y:  0, type: 'in',  dir: 'left' },
      out:    { x:  40, y:  0, type: 'out', dir: 'right' },
      branch: { x:   0, y: 35, type: 'out', dir: 'down' },
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
      in: { x: -60, y: 0, type: 'in', dir: 'left' },
    },
    defaultProps: { roomName: '', flowRate: '', power: '' },
  },
};

export function getPortAbsPos(element, portId) {
  const config = ELEMENT_TYPES[element.type];
  if (!config) return null;
  const port = config.ports[portId];
  if (!port) return null;
  return { x: element.x + port.x, y: element.y + port.y, dir: port.dir };
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