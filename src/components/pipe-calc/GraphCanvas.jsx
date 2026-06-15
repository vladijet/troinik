/**
 * GraphCanvas — топологическая схема.
 * Узлы = компоненты. Рёбра = трубы.
 * Снэппинг порта при перетаскивании узла.
 * Клик по ребру → выбор трубы.
 */
import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getPortAbsPos, NODE_PORT_CONFIG, NODE_SIZE } from '@/lib/hydraulicGraph';

const BG    = '#0f172a';
const GRID  = '#1e3a5f';
const SNAP  = 20;
const PORT_SNAP_R = 24; // радиус магнитного захвата порта

function snapGrid(v) { return Math.round(v / SNAP) * SNAP; }

// Кубическая кривая между двумя портами
function edgePath(fromNode, fromPortId, toNode, toPortId) {
  const a = getPortAbsPos(fromNode, fromPortId);
  const b = getPortAbsPos(toNode, toPortId);
  if (!a || !b) return '';
  const dist = Math.max(36, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
  const ctrl = { right: [dist,0], left: [-dist,0], down: [0,dist], up: [0,-dist] };
  const [c1x,c1y] = ctrl[a.dir] || [dist,0];
  const revDir = { right:'left', left:'right', down:'up', up:'down' };
  const [c2x,c2y] = ctrl[revDir[b.dir]] || [-dist,0];
  return `M${a.x},${a.y} C${a.x+c1x},${a.y+c1y} ${b.x+c2x},${b.y+c2y} ${b.x},${b.y}`;
}

// Середина пути (для метки)
function pathMidpoint(fromNode, fromPortId, toNode, toPortId) {
  const a = getPortAbsPos(fromNode, fromPortId);
  const b = getPortAbsPos(toNode, toPortId);
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Символы узлов ────────────────────────────────────────────────────────────
function PumpSymbol({ sel, res }) {
  const s = sel ? '#a78bfa' : '#3b82f6';
  return (
    <g>
      <circle r={24} fill={BG} stroke={s} strokeWidth={sel ? 2 : 1.5} />
      {[0,120,240].map(a => <line key={a} x1={0} y1={0} x2={0} y2={-15} stroke={s} strokeWidth={1.5} transform={`rotate(${a})`} opacity={0.8} />)}
      <circle r={4} fill={s} />
      <text y={36} textAnchor="middle" fontSize={8} fill="#475569">НАСОС</text>
      {res && <text y={-32} textAnchor="middle" fontSize={7} fill="#a78bfa">H={res.head?.toFixed(2)}м  Q={res.flowRate?.toFixed(1)}л/мин</text>}
    </g>
  );
}

function TeeSymbol({ sel }) {
  const s = sel ? '#34d399' : '#10b981';
  return (
    <g>
      <line x1={-28} y1={0} x2={28} y2={0} stroke={s} strokeWidth={3} strokeLinecap="round" />
      <line x1={0}   y1={0} x2={0}  y2={28} stroke={s} strokeWidth={3} strokeLinecap="round" />
      <circle r={4} fill={s} />
    </g>
  );
}

function ElbowSymbol({ sel }) {
  const s = sel ? '#fbbf24' : '#f59e0b';
  return (
    <g>
      <path d={`M -28,0 L 0,0 L 0,28`} fill="none" stroke={s} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle r={4} fill={s} />
    </g>
  );
}

function RadiatorSymbol({ sel, props, res }) {
  const s = sel ? '#f87171' : '#ef4444';
  const w = 100, h = 40;
  return (
    <g>
      {/* Корпус радиатора */}
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={3} fill={BG} stroke={s} strokeWidth={sel?2:1.5} />
      {[-32,-16,0,16,32].map(x => (
        <line key={x} x1={x} y1={-h/2+4} x2={x} y2={h/2-4} stroke={s} strokeWidth={2} opacity={0.55} />
      ))}
      {/* Трубка подключения сверху по центру */}
      <line x1={0} y1={-h/2} x2={0} y2={-20} stroke={s} strokeWidth={2} opacity={0.8} />
      {props?.roomName && <text y={-h/2-22} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="600">{props.roomName}</text>}
      {res?.flowRate != null && <text y={h/2+12} textAnchor="middle" fontSize={7} fill="#34d399">Q={res.flowRate.toFixed(2)} л/мин / {(res.flowRate * 0.06).toFixed(3)} м³/ч</text>}
    </g>
  );
}

// ─── Порт ─────────────────────────────────────────────────────────────────────
function PortDot({ px, py, portId, nodeId, nodeType, isOpen, isError, isCapped, isIn, onPortClick }) {
  const color = isError ? '#ef4444'
    : isCapped ? '#475569'
    : isOpen ? '#4ade80'
    : '#1e3a5f';
  const r = isOpen && !isCapped ? 6 : 4;

  // Метка порта: только для открытых незаглушённых портов tee/elbow
  const showLabel = isOpen && !isCapped && (nodeType === 'tee' || nodeType === 'elbow');
  const label = isIn ? 'IN' : (portId === 'branch' ? 'BR' : 'OUT');
  const labelColor = isIn ? '#60a5fa' : portId === 'branch' ? '#34d399' : '#f59e0b';

  // Смещение метки (чтобы не перекрывала порт)
  const labelOff = { x: px > 0 ? 12 : px < 0 ? -12 : 0, y: py > 0 ? 14 : py < 0 ? -14 : 0 };

  return (
    <g transform={`translate(${px},${py})`}
      onClick={e => { e.stopPropagation(); onPortClick(nodeId, portId); }}
      style={{ cursor: 'pointer' }}>
      {isOpen && !isCapped && (
        <circle r={12} fill="none" stroke={isError ? '#ef4444' : '#4ade80'} strokeWidth={1.2} opacity={0.3} />
      )}
      <circle r={r} fill={color} stroke={BG} strokeWidth={1} />
      {/* Заглушка: крестик */}
      {isCapped && (
        <g stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round">
          <line x1={-4} y1={-4} x2={4} y2={4} />
          <line x1={4} y1={-4} x2={-4} y2={4} />
          <circle r={7} fill="none" stroke="#ef444488" strokeWidth={1} />
        </g>
      )}
      {/* Метка IN/OUT/BR */}
      {showLabel && (
        <text x={labelOff.x} y={labelOff.y} textAnchor="middle"
          fontSize={7} fontWeight="700" fill={labelColor}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Узел ─────────────────────────────────────────────────────────────────────
function GraphNode({ node, sel, res, usedPorts, errorPorts, cappedPorts, inPorts, onMouseDown, onClick, onPortClick, onRotate }) {
  const config = NODE_PORT_CONFIG[node.type];
  const size   = NODE_SIZE[node.type];
  if (!config) return null;
  const rot = node.rotation || 0;
  const rad = rot * Math.PI / 180;
  const cos = Math.round(Math.cos(rad) * 1e9) / 1e9;
  const sin = Math.round(Math.sin(rad) * 1e9) / 1e9;

  return (
    <g transform={`translate(${node.x},${node.y})`}
      onMouseDown={onMouseDown} onClick={onClick}
      style={{ cursor: 'move', userSelect: 'none' }}>

      {sel && <rect x={-size.width/2-10} y={-size.height/2-10}
        width={size.width+20} height={size.height+20}
        rx={4} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 3" opacity={0.6} />}

      <g transform={`rotate(${rot})`}>
        {node.type === 'pump'     && <PumpSymbol     sel={sel} res={res} />}
        {node.type === 'tee'      && <TeeSymbol      sel={sel} />}
        {node.type === 'elbow'    && <ElbowSymbol    sel={sel} />}
        {node.type === 'radiator' && <RadiatorSymbol sel={sel} props={node.props} res={res} />}
      </g>

      {/* Порты */}
      {Object.entries(config).map(([pid, p]) => {
        const rx = p.x * cos - p.y * sin;
        const ry = p.x * sin + p.y * cos;
        const key = `${node.id}:${pid}`;
        const isOpen = !usedPorts.has(key);
        const isError = errorPorts.has(key);
        const isCapped = cappedPorts.has(key);
        const isIn = inPorts.has(key);
        return (
          <PortDot key={pid} px={rx} py={ry} portId={pid} nodeId={node.id} nodeType={node.type}
            isOpen={isOpen} isError={isError} isCapped={isCapped} isIn={isIn} onPortClick={onPortClick} />
        );
      })}

      {/* Кнопка поворота */}
      {sel && node.type !== 'pump' && (
        <g transform={`translate(${size.width/2+14},${-size.height/2-10})`}
          onClick={e => { e.stopPropagation(); onRotate(node.id); }}
          style={{ cursor: 'pointer' }}>
          <circle r={9} fill="#1e293b" stroke="#3b82f6" strokeWidth={1.5} />
          <text textAnchor="middle" fontSize={11} fill="#93c5fd" dy={4}>↻</text>
        </g>
      )}
    </g>
  );
}

// ─── BFS-нумерация труб от насоса ────────────────────────────────────────────
function buildEdgeNumbers(nodes, edges) {
  const pump = nodes.find(n => n.type === 'pump');
  if (!pump) return {};

  // строим список смежности: nodeId → [{edgeId, neighborId}]
  const adj = {};
  nodes.forEach(n => (adj[n.id] = []));
  edges.forEach(e => {
    adj[e.fromNodeId]?.push({ edgeId: e.id, neighborId: e.toNodeId });
    adj[e.toNodeId]?.push({ edgeId: e.id, neighborId: e.fromNodeId });
  });

  const edgeNum = {};
  let counter = 1;
  const visitedEdges = new Set();
  const visitedNodes = new Set([pump.id]);
  const queue = [pump.id];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    for (const { edgeId, neighborId } of adj[nodeId] || []) {
      if (visitedEdges.has(edgeId)) continue;
      visitedEdges.add(edgeId);
      edgeNum[edgeId] = counter++;
      if (!visitedNodes.has(neighborId)) {
        visitedNodes.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return edgeNum;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const GraphCanvas = forwardRef(function GraphCanvas({
  nodes, edges, selectedId, results, openPorts, cappedPorts, inPorts,
  onNodeMove, onNodeClick, onPortClick, onRotate, onEdgeClick, onDropElement,
}, ref) {
  const svgRef = useRef(null);
  useImperativeHandle(ref, () => svgRef.current, []);

  const [vp, setVp]   = useState({ x: 160, y: 200, scale: 1 });
  const [drag, setDrag] = useState(null);
  const [pan,  setPan]  = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edgeNumbers = buildEdgeNumbers(nodes, edges);

  const usedPorts = new Set(edges.flatMap(e => [
    `${e.fromNodeId}:${e.fromPortId}`, `${e.toNodeId}:${e.toPortId}`,
  ]));

  const errorPortSet = new Set((openPorts || []).map(p => `${p.nodeId}:${p.portId}`));
  const cappedSet = cappedPorts || new Set();
  const inPortSet = inPorts || new Set();

  function getSVG(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toCanvas(sx, sy) {
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const { x, y } = getSVG(e);
      const s = Math.max(0.2, Math.min(4, vp.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      setVp(v => ({ x: x - (x - v.x) * (s / v.scale), y: y - (y - v.y) * (s / v.scale), scale: s }));
    } else {
      setVp(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  }, [vp]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const { x, y } = getSVG(e);
    if (e.target === svgRef.current || e.target.closest('.cbg')) {
      setPan({ sx: x - vp.x, sy: y - vp.y });
      onNodeClick(null);
    }
  }, [vp, onNodeClick]);

  const handleMouseMove = useCallback((e) => {
    const { x, y } = getSVG(e);
    if (pan) { setVp(v => ({ ...v, x: x - pan.sx, y: y - pan.sy })); return; }
    if (!drag) return;

    const cp = toCanvas(x, y);
    let nx = snapGrid(cp.x - drag.ox);
    let ny = snapGrid(cp.y - drag.oy);

    const movingNode = { ...nodeMap[drag.id], x: nx, y: ny };
    const movingConfig = NODE_PORT_CONFIG[movingNode.type];
    if (movingConfig) {
      outer: for (const [myPortId] of Object.entries(movingConfig)) {
        const myPos = getPortAbsPos(movingNode, myPortId);
        if (!myPos) continue;
        for (const other of nodes) {
          if (other.id === drag.id) continue;
          const otherConfig = NODE_PORT_CONFIG[other.type];
          if (!otherConfig) continue;
          for (const [otherPortId] of Object.entries(otherConfig)) {
            if (usedPorts.has(`${other.id}:${otherPortId}`) && !usedPorts.has(`${drag.id}:${myPortId}`)) continue;
            const oPos = getPortAbsPos(other, otherPortId);
            if (!oPos) continue;
            const dist = Math.hypot(myPos.x - oPos.x, myPos.y - oPos.y);
            if (dist < PORT_SNAP_R) {
              nx = nx + (oPos.x - myPos.x);
              ny = ny + (oPos.y - myPos.y);
              break outer;
            }
          }
        }
      }
    }

    onNodeMove(drag.id, nx, ny);
  }, [pan, drag, vp, nodes, onNodeMove, usedPorts, nodeMap]);

  const handleMouseUp = useCallback(() => { setPan(null); setDrag(null); }, []);

  const startDrag = useCallback((e, id) => {
    e.stopPropagation();
    const cp = toCanvas(...Object.values(getSVG(e)));
    const n = nodes.find(n => n.id === id);
    setDrag({ id, ox: cp.x - n.x, oy: cp.y - n.y });
  }, [nodes, vp]);

  const gs = SNAP * vp.scale;
  const gox = ((vp.x % gs) + gs) % gs;
  const goy = ((vp.y % gs) + gs) % gs;
  const dotR = Math.max(0.5, vp.scale * 0.3);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData('elementType');
    if (!type || !onDropElement) return;
    const { x: sx, y: sy } = getSVG(e);
    const cx = snapGrid((sx - vp.x) / vp.scale);
    const cy = snapGrid((sy - vp.y) / vp.scale);
    onDropElement(type, cx, cy);
  }, [vp, onDropElement]);

  return (
    <svg ref={svgRef} className="w-full h-full"
      style={{ cursor: pan ? 'grabbing' : 'default', background: dragOver ? '#0f1f30' : BG }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp} onWheel={handleWheel}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

      <defs>
        <pattern id="dotGrid" patternUnits="userSpaceOnUse" x={gox} y={goy} width={gs} height={gs}>
          <circle cx={dotR} cy={dotR} r={dotR} fill={GRID} />
        </pattern>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" opacity={0.7} />
        </marker>
        <marker id="arr-ret" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" opacity={0.7} />
        </marker>
      </defs>

      <rect className="cbg" width="100%" height="100%" fill={BG} />
      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
        {edges.map(edge => {
          const from = nodeMap[edge.fromNodeId];
          const to   = nodeMap[edge.toNodeId];
          if (!from || !to) return null;
          const d   = edgePath(from, edge.fromPortId, to, edge.toPortId);
          const mid = pathMidpoint(from, edge.fromPortId, to, edge.toPortId);
          const res = results?.[edge.id];
          const isSel = selectedId === edge.id;
          const supplyColor = isSel ? '#fca5a5' : '#ef4444';
          const returnColor = isSel ? '#60a5fa' : '#3b82f6';

          return (
            <g key={edge.id} onClick={e => { e.stopPropagation(); onEdgeClick(edge.id); }}
              style={{ cursor: 'pointer' }}>
              <path d={d} stroke="transparent" strokeWidth={20} fill="none" />
              <path d={d} stroke="#000" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.2} />
              <path d={d} stroke={returnColor} strokeWidth={isSel ? 2.5 : 1.8}
                fill="none" strokeLinecap="round"
                style={{ transform: 'translate(2px, 2px)' }}
                markerEnd="url(#arr-ret)" />
              <path d={d} stroke={supplyColor} strokeWidth={isSel ? 2.5 : 1.8}
                fill="none" strokeLinecap="round"
                markerEnd="url(#arr)" />
              {isSel && <path d={d} stroke="#ffffff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.08} />}

              {mid && (
                <g style={{ pointerEvents: 'none' }} transform={`translate(${mid.x + 12}, ${mid.y - 22})`}>
                  <rect x={-2} y={-8} width={res ? 190 : 80} height={res ? 36 : 16}
                    rx={3} fill="#0f172a" opacity={0.82} />
                  <text x={0} y={0} fontSize={7} fontWeight="700" fill={isSel ? '#e2e8f0' : '#64748b'}>
                    {`Труба - ${edgeNumbers[edge.id] ?? '?'}`}
                  </text>
                  <text x={0} y={10} fontSize={7} fill={isSel ? '#93c5fd' : '#475569'}>
                    {res
                      ? `Ø${res.size?.outer}×${res.size?.wall} · ${res.velocity?.toFixed(2)}м/с`
                      : `L=${edge.pipeProps?.length || '?'}м (×2)`}
                  </text>
                  {res && (
                    <text x={0} y={20} fontSize={7} fill="#34d399">
                      Q={res.flowRate?.toFixed(2)} л/мин ({(res.flowRate * 0.06).toFixed(3)} м³/ч) · ΔP={res.pressureLoss?.toFixed(0)} Па
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {nodes.map(node => (
          <GraphNode key={node.id}
            node={node}
            sel={selectedId === node.id}
            res={results?.[node.id]}
            usedPorts={usedPorts}
            errorPorts={errorPortSet}
            cappedPorts={cappedSet}
            inPorts={inPortSet}
            onMouseDown={e => startDrag(e, node.id)}
            onClick={e => { e.stopPropagation(); onNodeClick(node.id); }}
            onPortClick={onPortClick}
            onRotate={onRotate}
          />
        ))}
      </g>

      {/* HUD */}
      <g transform="translate(10,10)">
        <rect width={140} height={16} rx={3} fill="#1e293b" opacity={0.8} />
        <text x={6} y={11} fontSize={8} fill="#475569">
          {(vp.scale*100).toFixed(0)}%  ·  тяните для панорамирования
        </text>
      </g>
    </svg>
  );
});

export default GraphCanvas;