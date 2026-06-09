/**
 * GraphCanvas — clean engineering vector rendering of the hydraulic graph
 * Nodes are drawn as minimal schematic symbols, edges as clean lines
 */
import { useRef, useState, useCallback } from 'react';
import { getPortAbsPos, NODE_PORT_CONFIG, NODE_SIZE } from '@/lib/hydraulicGraph';

const DARK = { bg: '#0f172a', grid: '#1e3a5f', pipe: '#3b82f6', pipeHighlight: '#93c5fd' };
const SNAP = 20;

function snapGrid(v) { return Math.round(v / SNAP) * SNAP; }

function dirCtrl(dir, dist) {
  if (dir === 'right') return { x: dist,  y: 0     };
  if (dir === 'left')  return { x: -dist, y: 0     };
  if (dir === 'down')  return { x: 0,     y: dist  };
  return                      { x: 0,     y: -dist };
}

function oppDir(dir) {
  return { right: 'left', left: 'right', down: 'up', up: 'down' }[dir] || 'left';
}

function edgePath(fromNode, fromPortId, toNode, toPortId) {
  const from = getPortAbsPos(fromNode, fromPortId);
  const to   = getPortAbsPos(toNode,   toPortId);
  if (!from || !to) return '';
  const dist = Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.4);
  const c1 = dirCtrl(from.dir, dist);
  const c2 = dirCtrl(oppDir(to.dir), dist);
  return `M ${from.x} ${from.y} C ${from.x + c1.x} ${from.y + c1.y} ${to.x + c2.x} ${to.y + c2.y} ${to.x} ${to.y}`;
}

// ─── Node symbols (engineering schematic style) ───────────────────────────────
function PumpSymbol({ selected, results }) {
  const stroke = selected ? '#a78bfa' : '#3b82f6';
  return (
    <g>
      <circle r={26} fill="#0f172a" stroke={stroke} strokeWidth={selected ? 2 : 1.5} />
      {/* impeller blades */}
      {[0, 120, 240].map(a => (
        <line key={a}
          x1={0} y1={0} x2={0} y2={-18}
          stroke={stroke} strokeWidth={1.5}
          transform={`rotate(${a})`} opacity={0.8}
        />
      ))}
      <circle r={4} fill={stroke} />
      {/* outlet stub */}
      <line x1={26} y1={0} x2={36} y2={0} stroke={stroke} strokeWidth={3} />
      <text y={42} textAnchor="middle" fontSize={8} fill="#475569" letterSpacing={0.5}>НАСОС</text>
      {results && (
        <text y={-34} textAnchor="middle" fontSize={7} fill="#a78bfa">
          H={results.head?.toFixed(2)}м
        </text>
      )}
    </g>
  );
}

function PipeSymbol({ selected, props, results }) {
  const stroke = selected ? '#60a5fa' : '#3b82f6';
  const len = Math.max(96, Math.min(380, (parseFloat(props?.length) || 1) * 48));
  const label = results
    ? `Ø${results.size?.outer}×${results.size?.wall}  v=${results.velocity?.toFixed(2)}м/с`
    : `L = ${props?.length || '?'} м`;

  return (
    <g>
      {/* pipe body: two parallel lines */}
      <line x1={-len/2} y1={-5} x2={len/2} y2={-5} stroke={stroke} strokeWidth={2} />
      <line x1={-len/2} y1={ 5} x2={len/2} y2={ 5} stroke={stroke} strokeWidth={2} />
      {/* end caps */}
      <line x1={-len/2} y1={-8} x2={-len/2} y2={8} stroke={stroke} strokeWidth={2} />
      <line x1={ len/2} y1={-8} x2={ len/2} y2={8} stroke={stroke} strokeWidth={2} />
      {/* center axis */}
      <line x1={-len/2} y1={0} x2={len/2} y2={0}
        stroke={stroke} strokeWidth={0.8} strokeDasharray="8 4" opacity={0.4} />
      {/* flow arrow */}
      <path d={`M -6,0 L 6,-5 L 6,5 Z`} fill={stroke} opacity={0.6} />
      <text y={-14} textAnchor="middle" fontSize={8} fill="#64748b">{label}</text>
      {results?.pressureLoss > 0 && (
        <text y={18} textAnchor="middle" fontSize={7} fill="#fbbf24">
          ΔP={results.pressureLoss?.toFixed(0)} Па
        </text>
      )}
    </g>
  );
}

function TeeSymbol({ selected, results }) {
  const stroke = selected ? '#34d399' : '#10b981';
  return (
    <g>
      {/* horizontal bar */}
      <line x1={-40} y1={-5} x2={40} y2={-5} stroke={stroke} strokeWidth={2} />
      <line x1={-40} y1={ 5} x2={40} y2={ 5} stroke={stroke} strokeWidth={2} />
      {/* branch */}
      <line x1={-5} y1={5} x2={-5} y2={36} stroke={stroke} strokeWidth={2} />
      <line x1={ 5} y1={5} x2={ 5} y2={36} stroke={stroke} strokeWidth={2} />
      {/* caps */}
      <line x1={-40} y1={-8} x2={-40} y2={8} stroke={stroke} strokeWidth={2} />
      <line x1={ 40} y1={-8} x2={ 40} y2={8} stroke={stroke} strokeWidth={2} />
      <line x1={-8} y1={36} x2={8} y2={36}  stroke={stroke} strokeWidth={2} />
      <text y={-14} textAnchor="middle" fontSize={7} fill="#475569">ТЕЕ</text>
      {results?.size && (
        <text y={50} textAnchor="middle" fontSize={7} fill={stroke}>Ø{results.size.outer}</text>
      )}
    </g>
  );
}

function ElbowSymbol({ selected, results }) {
  const stroke = selected ? '#fbbf24' : '#f59e0b';
  return (
    <g>
      {/* horizontal part */}
      <line x1={-30} y1={-5} x2={0} y2={-5} stroke={stroke} strokeWidth={2} />
      <line x1={-30} y1={ 5} x2={0} y2={ 5} stroke={stroke} strokeWidth={2} />
      {/* vertical part */}
      <line x1={-5} y1={0}  x2={-5} y2={30} stroke={stroke} strokeWidth={2} />
      <line x1={ 5} y1={0}  x2={ 5} y2={30} stroke={stroke} strokeWidth={2} />
      {/* caps */}
      <line x1={-30} y1={-8} x2={-30} y2={8} stroke={stroke} strokeWidth={2} />
      <line x1={-8} y1={30}  x2={8}  y2={30} stroke={stroke} strokeWidth={2} />
      {/* corner arc */}
      <path d="M -5,0 Q 5,0 5,10" fill="none" stroke={stroke} strokeWidth={2} />
      <text x={8} y={-10} fontSize={7} fill="#475569">90°</text>
      {results?.size && (
        <text x={8} y={0} fontSize={7} fill={stroke}>Ø{results.size.outer}</text>
      )}
    </g>
  );
}

function RadiatorSymbol({ selected, props, results }) {
  const stroke = selected ? '#f87171' : '#ef4444';
  const w = 120, h = 42;
  const sections = [-44, -30, -16, -2, 12, 26, 40];
  return (
    <g>
      {/* outer rect */}
      <rect x={-w/2} y={-h/2} width={w} height={h}
        fill="#0f172a" stroke={stroke} strokeWidth={selected ? 2 : 1.5} rx={3} />
      {/* section fins */}
      {sections.map(sx => (
        <line key={sx} x1={sx} y1={-h/2+4} x2={sx} y2={h/2-4}
          stroke={stroke} strokeWidth={2} opacity={0.6} />
      ))}
      {/* heat symbol */}
      {[0].map((_, i) => (
        <path key={i} d="M 0,-8 Q 4,-4 0,0 Q -4,4 0,8"
          stroke={stroke} strokeWidth={1} fill="none" opacity={0.5} />
      ))}
      {props?.roomName && (
        <text y={-h/2 - 8} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="600">
          {props.roomName}
        </text>
      )}
      {results?.flowRate != null && (
        <text y={h/2 + 12} textAnchor="middle" fontSize={7} fill="#34d399">
          Q={results.flowRate.toFixed(2)} л/мин
        </text>
      )}
    </g>
  );
}

// ─── Port dots ────────────────────────────────────────────────────────────────
function PortDot({ portCfg, portId, active, nodeId, onPortClick }) {
  const isIn = portCfg.type === 'in';
  const color = active ? '#ef4444' : isIn ? '#60a5fa' : '#4ade80';
  return (
    <g
      transform={`translate(${portCfg.x}, ${portCfg.y})`}
      onClick={e => { e.stopPropagation(); onPortClick(nodeId, portId); }}
      style={{ cursor: 'pointer' }}
    >
      {active && <circle r={12} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.35} />}
      <circle r={active ? 6 : 4} fill={color} stroke="#0f172a" strokeWidth={1} />
    </g>
  );
}

// ─── Single graph node ────────────────────────────────────────────────────────
function GraphNode({ node, selected, results, activePort, usedPorts, onMouseDown, onClick, onPortClick, onRotate }) {
  const config = NODE_PORT_CONFIG[node.type];
  const size   = NODE_SIZE[node.type];
  if (!config) return null;
  const rot = node.rotation || 0;

  const isActive = (pid) => activePort?.nodeId === node.id && activePort?.portId === pid;

  // Rotate port positions
  const rotatedPorts = {};
  const deg = rot * Math.PI / 180;
  const cos = Math.round(Math.cos(deg) * 1e9) / 1e9;
  const sin = Math.round(Math.sin(deg) * 1e9) / 1e9;
  Object.entries(config).forEach(([pid, p]) => {
    rotatedPorts[pid] = { ...p, x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
  });

  return (
    <g transform={`translate(${node.x}, ${node.y})`} onMouseDown={onMouseDown} onClick={onClick}
      style={{ cursor: 'move', userSelect: 'none' }}>

      {/* selection box */}
      {selected && (
        <rect x={-size.width/2 - 10} y={-size.height/2 - 10}
          width={size.width + 20} height={size.height + 20}
          rx={4} fill="none" stroke="#3b82f6" strokeWidth={1}
          strokeDasharray="5 3" opacity={0.6} />
      )}

      <g transform={`rotate(${rot})`}>
        {node.type === 'pump'     && <PumpSymbol     selected={selected} results={results} />}
        {node.type === 'pipe'     && <PipeSymbol     selected={selected} props={node.props} results={results} />}
        {node.type === 'tee'      && <TeeSymbol      selected={selected} results={results} />}
        {node.type === 'elbow'    && <ElbowSymbol    selected={selected} results={results} />}
        {node.type === 'radiator' && <RadiatorSymbol selected={selected} props={node.props} results={results} />}
      </g>

      {/* Ports */}
      {Object.entries(rotatedPorts).map(([pid, portCfg]) => {
        const connected = usedPorts.has(`${node.id}:${pid}`);
        const active = isActive(pid);
        if (connected && !active) return null;
        return (
          <PortDot key={pid} portCfg={portCfg} portId={pid}
            active={active} nodeId={node.id} onPortClick={onPortClick} />
        );
      })}

      {/* Rotate button */}
      {selected && node.type !== 'pump' && (
        <g transform={`translate(${size.width/2 + 14}, ${-size.height/2 - 10})`}
          onClick={e => { e.stopPropagation(); onRotate(node.id); }}
          style={{ cursor: 'pointer' }}>
          <circle r={9} fill="#1e293b" stroke="#3b82f6" strokeWidth={1.5} />
          <text textAnchor="middle" fontSize={10} fill="#93c5fd" dy={4}>↻</text>
        </g>
      )}
    </g>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────
export default function GraphCanvas({
  nodes, edges, activePort, selectedId, results,
  onNodeMove, onNodeClick, onPortClick, onRotate,
}) {
  const svgRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 120, y: 160, scale: 1 });
  const [dragging, setDragging] = useState(null);
  const [panning,  setPanning]  = useState(null);

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const usedPortsFor = (nodeId) => {
    const s = new Set();
    edges.forEach(e => {
      if (e.fromNodeId === nodeId) s.add(`${nodeId}:${e.fromPortId}`);
      if (e.toNodeId   === nodeId) s.add(`${nodeId}:${e.toPortId}`);
    });
    return s;
  };

  function getSVG(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toCanvas(sx, sy) {
    return { x: (sx - viewport.x) / viewport.scale, y: (sy - viewport.y) / viewport.scale };
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getSVG(e);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const s = Math.max(0.2, Math.min(4, viewport.scale * factor));
    setViewport(v => ({
      x: x - (x - v.x) * (s / v.scale),
      y: y - (y - v.y) * (s / v.scale),
      scale: s,
    }));
  }, [viewport]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const { x, y } = getSVG(e);
    if (e.target === svgRef.current || e.target.closest('.canvas-bg')) {
      setPanning({ sx: x - viewport.x, sy: y - viewport.y });
      onNodeClick(null);
    }
  }, [viewport, onNodeClick]);

  const handleMouseMove = useCallback((e) => {
    const { x, y } = getSVG(e);
    if (panning) setViewport(v => ({ ...v, x: x - panning.sx, y: y - panning.sy }));
    if (dragging) {
      const cp = toCanvas(x, y);
      onNodeMove(dragging.id, snapGrid(cp.x - dragging.ox), snapGrid(cp.y - dragging.oy));
    }
  }, [panning, dragging, viewport, onNodeMove]);

  const handleMouseUp = useCallback(() => { setPanning(null); setDragging(null); }, []);

  const startDrag = useCallback((e, id) => {
    e.stopPropagation();
    const { x, y } = getSVG(e);
    const cp = toCanvas(x, y);
    const n = nodes.find(n => n.id === id);
    setDragging({ id, ox: cp.x - n.x, oy: cp.y - n.y });
  }, [nodes, viewport]);

  // Grid dots
  const gs = SNAP * viewport.scale;
  const gox = ((viewport.x % gs) + gs) % gs;
  const goy = ((viewport.y % gs) + gs) % gs;
  const dotR = Math.max(0.5, viewport.scale * 0.35);

  return (
    <svg ref={svgRef} className="w-full h-full"
      style={{ cursor: panning ? 'grabbing' : 'crosshair', background: DARK.bg }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp} onWheel={handleWheel}>

      <defs>
        <pattern id="dotGrid" patternUnits="userSpaceOnUse"
          x={gox} y={goy} width={gs} height={gs}>
          <circle cx={dotR} cy={dotR} r={dotR} fill={DARK.grid} opacity={0.9} />
        </pattern>
        <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" opacity={0.7} />
        </marker>
      </defs>

      <rect className="canvas-bg" width="100%" height="100%" fill={DARK.bg} />
      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}>
        {/* Edges (connections) */}
        {edges.map(edge => {
          const from = nodeMap[edge.fromNodeId];
          const to   = nodeMap[edge.toNodeId];
          if (!from || !to) return null;
          const d = edgePath(from, edge.fromPortId, to, edge.toPortId);
          return (
            <g key={edge.id}>
              <path d={d} stroke="#000" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.25} />
              <path d={d} stroke={DARK.pipe} strokeWidth={2.5} fill="none" strokeLinecap="round"
                markerEnd="url(#arrowBlue)" />
              <path d={d} stroke={DARK.pipeHighlight} strokeWidth={0.8} fill="none"
                strokeLinecap="round" opacity={0.35} />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <GraphNode key={node.id}
            node={node}
            selected={selectedId === node.id}
            results={results?.[node.id]}
            activePort={activePort}
            usedPorts={usedPortsFor(node.id)}
            onMouseDown={e => startDrag(e, node.id)}
            onClick={e => { e.stopPropagation(); onNodeClick(node.id); }}
            onPortClick={onPortClick}
            onRotate={onRotate}
          />
        ))}
      </g>

      {/* HUD */}
      <g transform="translate(12,12)">
        <rect width={110} height={18} rx={3} fill="#1e293b" opacity={0.85} />
        <text x={7} y={13} fontSize={9} fill="#475569">
          {(viewport.scale * 100).toFixed(0)}%  |  Зажмите и тяните для панорамирования
        </text>
      </g>
    </svg>
  );
}