import { ELEMENT_TYPES, getPortAbsPos } from './elementConfig';
import { COLORS } from './isoUtils';

// --- 3D pseudo helpers ---
function hex3d(cx, cy, w, h, depth, color) {
  // draws a box: front face + top face + right side
  const d = depth;
  const fx = cx - w / 2, fy = cy - h / 2;
  // front
  const front = `${fx},${fy} ${fx + w},${fy} ${fx + w},${fy + h} ${fx},${fy + h}`;
  // top (parallelogram going up-right)
  const topPts = `${fx},${fy} ${fx + w},${fy} ${fx + w - d},${fy - d * 0.5} ${fx - d},${fy - d * 0.5}`;
  // right side
  const rightPts = `${fx + w},${fy} ${fx + w},${fy + h} ${fx + w - d},${fy + h - d * 0.5} ${fx + w - d},${fy - d * 0.5}`;
  return { front, top: topPts, right: rightPts };
}

function PumpBody3D({ selected }) {
  const c = COLORS.pump;
  const s = selected ? '#a78bfa' : c.stroke;
  const depth = 10;
  const r = 28;
  // simplified: circle with 3D shadow
  return (
    <>
      {/* shadow ellipse */}
      <ellipse cx={6} cy={6} rx={r} ry={r * 0.45} fill="#000" opacity={0.18} />
      {/* side arc */}
      <circle r={r} fill={c.side} />
      {/* front circle */}
      <circle r={r} fill={c.fill} stroke={s} strokeWidth={2} cy={-4} />
      {/* impeller */}
      {[0, 120, 240].map(a => (
        <path key={a} d={`M0,-14 L10,6 L-10,6 Z`}
          fill={s} opacity={0.85}
          transform={`translate(0,-4) rotate(${a})`} />
      ))}
      <circle r={5} fill={s} cy={-4} />
      <text y={36} textAnchor="middle" fontSize={9} fill={c.label} fontWeight="700" letterSpacing="0.5">НАСОС</text>
      {/* port stub right */}
      <rect x={28} y={-7} width={14} height={10} fill={c.side} />
      <rect x={28} y={-7} width={14} height={10} fill={c.fill} stroke={s} strokeWidth={1} cy={-4} />
    </>
  );
}

function PipeBody3D({ selected, props, results, element }) {
  const c = COLORS.pipe;
  const s = selected ? '#60a5fa' : c.stroke;
  const rot = element.rotation || 0;
  // pipe length in pixels: 24px per meter, min 96
  const rawLen = props?.length > 0 ? props.length : 1;
  const pxLen = Math.max(96, Math.min(400, rawLen * 48));
  const w = pxLen, h = 20, depth = 8;
  const label = results
    ? `Ø${results.size?.outer}×${results.size?.wall}`
    : `L=${props?.length || '?'}м`;

  const faces = hex3d(0, 0, w, h, depth, c);
  return (
    <>
      <polygon points={faces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={faces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={faces.front} fill={c.fill} stroke={s} strokeWidth={1.5} />
      {/* center line */}
      <line x1={-w/2 + 6} y1={0} x2={w/2 - 6} y2={0} stroke={s} strokeWidth={1} strokeDasharray="6 4" opacity={0.5} />
      <text textAnchor="middle" fontSize={9} fill={c.label} fontWeight="600" dy={4}>{label}</text>
      {results && (
        <text y={-18} textAnchor="middle" fontSize={8} fill="#34d399">v={results.velocity?.toFixed(2)} м/с</text>
      )}
    </>
  );
}

function TeeBody3D({ selected, results }) {
  const c = COLORS.tee;
  const s = selected ? '#34d399' : c.stroke;
  const depth = 9;
  // horizontal bar
  const hFaces = hex3d(0, 0, 80, 20, depth, c);
  // vertical branch
  const vFaces = hex3d(0, 28, 20, 36, depth, c);
  return (
    <>
      {/* vertical branch */}
      <polygon points={vFaces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={vFaces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={vFaces.front} fill={c.fill} stroke={s} strokeWidth={1.5} />
      {/* horizontal bar */}
      <polygon points={hFaces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={hFaces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={hFaces.front} fill={c.fill} stroke={s} strokeWidth={1.5} />
      <text y={-18} textAnchor="middle" fontSize={8} fill={c.label} fontWeight="600">ТРОЙНИК</text>
      {results?.size && (
        <text y={56} textAnchor="middle" fontSize={7} fill="#34d399">Ø{results.size.outer}</text>
      )}
    </>
  );
}

function ElbowBody3D({ selected, results }) {
  const c = COLORS.elbow;
  const s = selected ? '#fbbf24' : c.stroke;
  const depth = 9;
  // horizontal part
  const hFaces = hex3d(-10, 0, 40, 20, depth, c);
  // vertical part
  const vFaces = hex3d(10, 20, 20, 36, depth, c);
  return (
    <>
      <polygon points={vFaces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={vFaces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={vFaces.front} fill={c.fill} stroke={s} strokeWidth={1.5} />
      <polygon points={hFaces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={hFaces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={hFaces.front} fill={c.fill} stroke={s} strokeWidth={1.5} />
      <text x={20} y={-14} fontSize={8} fill={c.label} fontWeight="600">УГОЛ</text>
      {results?.size && <text x={20} y={-4} fontSize={7} fill="#fcd34d">Ø{results.size.outer}</text>}
    </>
  );
}

function RadiatorBody3D({ selected, props, results }) {
  const c = COLORS.radiator;
  const s = selected ? '#f87171' : c.stroke;
  const w = 120, h = 46, depth = 12;
  const faces = hex3d(0, 0, w, h, depth, c);
  // sections
  const sections = [-44, -29, -14, 0, 15, 30, 44];
  return (
    <>
      <polygon points={faces.top} fill={c.top} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={faces.right} fill={c.side} stroke={s} strokeWidth={0.5} opacity={0.9} />
      <polygon points={faces.front} fill={c.fill} stroke={s} strokeWidth={2} />
      {/* section fins */}
      {sections.map(sx => (
        <line key={sx} x1={sx} y1={-h/2 + 4} x2={sx} y2={h/2 - 4}
          stroke={c.stroke} strokeWidth={2.5} opacity={0.6} />
      ))}
      {props?.roomName && (
        <text y={-h/2 - 8} textAnchor="middle" fontSize={9} fill={c.label} fontWeight="700">
          {props.roomName}
        </text>
      )}
      {results?.flowRate != null && (
        <text y={h/2 + 14} textAnchor="middle" fontSize={8} fill="#34d399">
          Q={results.flowRate.toFixed(2)} л/мин
        </text>
      )}
    </>
  );
}

// Port indicator
function Port({ portCfg, portId, active, elementId, onPortClick }) {
  const dir = portCfg.dir;
  const isIn = portCfg.type === 'in';
  const color = active ? '#ef4444' : isIn ? '#60a5fa' : '#4ade80';
  return (
    <g
      transform={`translate(${portCfg.x}, ${portCfg.y})`}
      onClick={e => { e.stopPropagation(); onPortClick(elementId, portId); }}
      style={{ cursor: 'pointer' }}
    >
      {active && <circle r={14} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.4} />}
      <circle r={active ? 7 : 5} fill={color} stroke="#fff" strokeWidth={1} opacity={0.9} />
      {/* type indicator */}
      <text textAnchor="middle" fontSize={6} fill="#fff" dy={2} style={{ pointerEvents: 'none' }}>
        {isIn ? '▶' : '◀'}
      </text>
    </g>
  );
}

export default function CanvasElement({
  element, selected, results, activePort, connections, onMouseDown, onClick, onPortClick, onRotate
}) {
  const config = ELEMENT_TYPES[element.type];
  if (!config) return null;

  const rot = element.rotation || 0;

  const usedPorts = new Set(
    connections.flatMap(c => [
      c.fromElementId === element.id ? `${element.id}:${c.fromPortId}` : null,
      c.toElementId === element.id ? `${element.id}:${c.toPortId}` : null,
    ]).filter(Boolean)
  );

  const isActive = (portId) =>
    activePort?.elementId === element.id && activePort?.portId === portId;

  return (
    <g
      transform={`translate(${element.x}, ${element.y})`}
      onMouseDown={onMouseDown}
      onClick={onClick}
      style={{ cursor: 'move', userSelect: 'none' }}
    >
      {/* selection glow */}
      {selected && (
        <rect
          x={-config.width / 2 - 8} y={-config.height / 2 - 8}
          width={config.width + 16} height={config.height + 16}
          rx={6} fill="none" stroke="#3b82f6" strokeWidth={1.5}
          strokeDasharray="6 3" opacity={0.7}
        />
      )}

      {/* rotated body */}
      <g transform={`rotate(${rot})`}>
        {element.type === 'pump'     && <PumpBody3D selected={selected} results={results} />}
        {element.type === 'pipe'     && <PipeBody3D selected={selected} props={element.props} results={results} element={element} />}
        {element.type === 'tee'      && <TeeBody3D  selected={selected} results={results} />}
        {element.type === 'elbow'    && <ElbowBody3D selected={selected} results={results} />}
        {element.type === 'radiator' && <RadiatorBody3D selected={selected} props={element.props} results={results} />}
      </g>

      {/* Ports — rendered in element space (unrotated), positions come from getPortAbsPos */}
      {Object.entries(config.ports).map(([portId, portCfgBase]) => {
        const connected = usedPorts.has(`${element.id}:${portId}`);
        const active = isActive(portId);

        // rotate port position
        const deg = rot * Math.PI / 180;
        const cos = Math.round(Math.cos(deg) * 1e9) / 1e9;
        const sin = Math.round(Math.sin(deg) * 1e9) / 1e9;
        const rx = portCfgBase.x * cos - portCfgBase.y * sin;
        const ry = portCfgBase.x * sin + portCfgBase.y * cos;
        const portCfg = { ...portCfgBase, x: rx, y: ry };

        if (connected && !active) return null;
        return (
          <Port
            key={portId}
            portCfg={portCfg}
            portId={portId}
            active={active}
            elementId={element.id}
            onPortClick={onPortClick}
          />
        );
      })}

      {/* Rotate button (shown when selected) */}
      {selected && element.type !== 'pump' && onRotate && (
        <g
          transform={`translate(${config.width / 2 + 12}, ${-config.height / 2 - 8})`}
          onClick={e => { e.stopPropagation(); onRotate(element.id); }}
          style={{ cursor: 'pointer' }}
        >
          <circle r={9} fill="#1e293b" stroke="#3b82f6" strokeWidth={1.5} />
          <text textAnchor="middle" fontSize={10} fill="#93c5fd" dy={4}>↻</text>
        </g>
      )}
    </g>
  );
}