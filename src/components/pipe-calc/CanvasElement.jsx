import { ELEMENT_TYPES } from './elementConfig';

function PumpBody({ selected, results }) {
  const s = selected ? '#2563eb' : '#3b82f6';
  const bg = selected ? '#dbeafe' : '#eff6ff';
  return (
    <>
      <circle r={29} fill={bg} stroke={s} strokeWidth={2} />
      <path d="M0,-16 L13,8 L-13,8 Z" fill={s} opacity={0.7} />
      <path d="M0,-16 L13,8 L-13,8 Z" fill={s} opacity={0.7} transform="rotate(120)" />
      <path d="M0,-16 L13,8 L-13,8 Z" fill={s} opacity={0.7} transform="rotate(240)" />
      <circle r={6} fill={s} />
      <text y={44} textAnchor="middle" fontSize={10} fill={s} fontWeight="600">Насос</text>
      {results?.flowRate != null && (
        <>
          <text y={57} textAnchor="middle" fontSize={9} fill="#059669">Q={results.flowRate.toFixed(1)} л/мин</text>
          <text y={68} textAnchor="middle" fontSize={9} fill="#059669">H={results.head?.toFixed(1)} м</text>
        </>
      )}
    </>
  );
}

function PipeBody({ selected, props, results }) {
  const s = selected ? '#2563eb' : '#64748b';
  const bg = selected ? '#f0f9ff' : '#f8fafc';
  const label = results
    ? `Ø${results.size?.outer}×${results.size?.wall}`
    : `L=${props?.length || '?'} м`;
  return (
    <>
      <rect x={-45} y={-12} width={90} height={24} rx={5} fill={bg} stroke={s} strokeWidth={1.5} />
      <text textAnchor="middle" fontSize={9} fill={s} fontWeight="500" dy={4}>{label}</text>
      {results && (
        <>
          <text y={-18} textAnchor="middle" fontSize={8} fill="#059669">v={results.velocity?.toFixed(2)} м/с</text>
          <text y={22} textAnchor="middle" fontSize={8} fill="#6b7280">ΔP={results.pressureLoss?.toFixed(0)} Па</text>
        </>
      )}
    </>
  );
}

function TeeBody({ selected, results }) {
  const s = selected ? '#2563eb' : '#475569';
  const bg = selected ? '#f0f9ff' : '#f8fafc';
  return (
    <>
      <rect x={-40} y={-12} width={80} height={24} rx={4} fill={bg} stroke={s} strokeWidth={1.5} />
      <rect x={-10} y={12} width={20} height={26} rx={4} fill={bg} stroke={s} strokeWidth={1.5} />
      <text y={-18} textAnchor="middle" fontSize={9} fill={s} fontWeight="500">Тройник</text>
      {results?.size && (
        <text y={50} textAnchor="middle" fontSize={8} fill="#059669">Ø{results.size.outer}</text>
      )}
    </>
  );
}

function ElbowBody({ selected, results }) {
  const s = selected ? '#2563eb' : '#475569';
  const bg = selected ? '#f0f9ff' : '#f8fafc';
  return (
    <>
      <rect x={-30} y={-10} width={40} height={20} rx={4} fill={bg} stroke={s} strokeWidth={1.5} />
      <rect x={-10} y={10} width={20} height={23} rx={4} fill={bg} stroke={s} strokeWidth={1.5} />
      <text x={14} y={-14} fontSize={9} fill={s} fontWeight="500">Угол</text>
      {results?.size && (
        <text x={14} y={-4} fontSize={8} fill="#059669">Ø{results.size.outer}</text>
      )}
    </>
  );
}

function RadiatorBody({ selected, props, results }) {
  const s = selected ? '#ea580c' : '#f97316';
  const bg = selected ? '#fff7ed' : '#fff';
  return (
    <>
      <rect x={-60} y={-24} width={120} height={48} rx={5} fill={bg} stroke={s} strokeWidth={1.5} />
      {[-35, -18, 0, 18, 35].map(lx => (
        <line key={lx} x1={lx} y1={-16} x2={lx} y2={16} stroke="#fed7aa" strokeWidth={3} />
      ))}
      {props?.roomName && (
        <text y={-30} textAnchor="middle" fontSize={9} fill="#9a3412" fontWeight="600">
          {props.roomName}
        </text>
      )}
      {results?.flowRate != null && (
        <text y={34} textAnchor="middle" fontSize={9} fill="#059669">Q={results.flowRate.toFixed(2)} л/мин</text>
      )}
    </>
  );
}

export default function CanvasElement({ element, selected, results, activePort, connections, onMouseDown, onClick, onPortClick }) {
  const config = ELEMENT_TYPES[element.type];
  if (!config) return null;

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
      {element.type === 'pump' && <PumpBody selected={selected} results={results} />}
      {element.type === 'pipe' && <PipeBody selected={selected} props={element.props} results={results} />}
      {element.type === 'tee' && <TeeBody selected={selected} results={results} />}
      {element.type === 'elbow' && <ElbowBody selected={selected} results={results} />}
      {element.type === 'radiator' && <RadiatorBody selected={selected} props={element.props} results={results} />}

      {/* Ports */}
      {Object.entries(config.ports).map(([portId, portCfg]) => {
        const connected = usedPorts.has(`${element.id}:${portId}`);
        const active = isActive(portId);
        if (connected) return null;
        return (
          <g
            key={portId}
            transform={`translate(${portCfg.x}, ${portCfg.y})`}
            onClick={e => { e.stopPropagation(); onPortClick(element.id, portId); }}
            style={{ cursor: 'pointer' }}
          >
            {active && <circle r={13} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.4} />}
            <circle r={active ? 6 : 5} fill={active ? '#ef4444' : '#94a3b8'} stroke={active ? '#dc2626' : '#64748b'} strokeWidth={1} />
          </g>
        );
      })}
    </g>
  );
}