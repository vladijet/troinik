/**
 * GraphCanvas — топологическая схема.
 * Узлы = компоненты. Рёбра = трубы.
 * Снэппинг порта при перетаскивании узла.
 * Клик по ребру → выбор трубы.
 */
import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getPortAbsPos, NODE_PORT_CONFIG, NODE_SIZE } from '@/lib/hydraulicGraph';
import { PIPE_TYPES } from '@/lib/pipeStandards';

const BG    = '#0f172a';
const GRID  = '#1e3a5f';
const SNAP  = 20;
const PORT_SNAP_R = 24; // радиус магнитного захвата порта

function snapGrid(v) { return Math.round(v / SNAP) * SNAP; }

// Смещает кубическую кривую Безье на offset пикселей по нормали к вектору AB
function offsetBezier(ax, ay, c1x, c1y, c2x, c2y, bx, by, offset) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // нормаль (перпендикуляр)
  const ny =  dx / len;
  const ox = nx * offset;
  const oy = ny * offset;
  return `M${ax+ox},${ay+oy} C${c1x+ox},${c1y+oy} ${c2x+ox},${c2y+oy} ${bx+ox},${by+oy}`;
}

function edgePaths(fromNode, fromPortId, toNode, toPortId) {
  const a = getPortAbsPos(fromNode, fromPortId);
  const b = getPortAbsPos(toNode, toPortId);
  if (!a || !b) return { supply: '', ret: '', center: '' };
  const dist = Math.max(36, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
  const ctrl = { right: [dist,0], left: [-dist,0], down: [0,dist], up: [0,-dist] };
  const [c1x,c1y] = ctrl[a.dir] || [dist,0];
  const revDir = { right:'left', left:'right', down:'up', up:'down' };
  const [c2x,c2y] = ctrl[revDir[b.dir]] || [-dist,0];
  const ax = a.x, ay = a.y, bx = b.x, by = b.y;
  const ac1x = ax+c1x, ac1y = ay+c1y, bc2x = bx+c2x, bc2y = by+c2y;
  return {
    supply: offsetBezier(ax, ay, ac1x, ac1y, bc2x, bc2y, bx, by, -1.2),
    ret:    offsetBezier(ax, ay, ac1x, ac1y, bc2x, bc2y, bx, by,  1.2),
    center: `M${ax},${ay} C${ac1x},${ac1y} ${bc2x},${bc2y} ${bx},${by}`,
  };
}

// Середина пути (середина кривой Безье при t=0.5)
function pathMidpoint(fromNode, fromPortId, toNode, toPortId) {
  const a = getPortAbsPos(fromNode, fromPortId);
  const b = getPortAbsPos(toNode, toPortId);
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Чипсина трубы ────────────────────────────────────────────────────────────
// Компактный: одна строка. Развёрнутый: столбик строк, центрирован по (0,0).
const CHIP_LINE_H = 14; // межстрочный интервал px
const CHIP_PAD_X = 12;
const CHIP_PAD_Y = 10;
const CHIP_FONT  = 8.5;

const PIPE_SHORT = {
  ppr_pn20: 'PP-R',
  ppr_pn25: 'PP-R',
  metal_plastic: 'PEX-AL-PEX',
  pex: 'PEX',
  stainless_steel: 'Нерж.',
};

function EdgeChip({ edge, res, labelNum, expanded, onToggle, pipeType }) {
  const length = edge.pipeProps?.length;
  const pipeShort = pipeType ? (PIPE_SHORT[pipeType] || pipeType) : null;

  // ── Строки развёрнутого режима ──
  const lines = [
    { text: `Труба-${labelNum}`, accent: length ? `, L=${length}м.` : '', color: '#e2e8f0', accentColor: '#3b82f6', bold: true },
    res?.size
      ? { text: `Ø ${res.size.outer}×${res.size.wall}${pipeShort ? ` ${pipeShort}` : ''}`, color: '#64748b' }
      : null,
    res?.flowRate != null
      ? { text: `${res.flowRate.toFixed(2)}л/мин (${(res.flowRate * 0.06).toFixed(3)} м³/ч)`, color: '#34d399' }
      : null,
    res
      ? { text: `v=${res.velocity?.toFixed(3)} м/с;`, color: '#fbbf24' }
      : null,
  ].filter(Boolean);

  // ── Размеры ──
  const CHAR_W = 5.2;
  const expandedW = Math.max(130, Math.max(...lines.map(l =>
    ((l.text?.length || 0) + (l.accent?.length || 0)) * CHAR_W
  )) + CHIP_PAD_X * 2);
  const expandedH = lines.length * CHIP_LINE_H + CHIP_PAD_Y * 2;

  const compactText = `Труба-${labelNum}${length ? ` ${length}м` : ''}${res?.size ? ` Ø${res.size.outer}×${res.size.wall}${pipeShort ? ` ${pipeShort}` : ''}` : ''}`;
  const compactW = Math.max(60, compactText.length * 4.5 + 16);
  const compactH = 18;

  const w = expanded ? expandedW : compactW;
  const h = expanded ? expandedH : compactH;
  const rx = expanded ? 10 : 9;

  return (
    <g
      transform={`translate(${-w / 2},${-h / 2})`}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      style={{ cursor: 'pointer' }}>

      {/* Фон — без рамки */}
      <rect
        width={w} height={h} rx={rx}
        fill={expanded ? 'rgba(15,28,50,0.93)' : 'rgba(15,25,48,0.82)'}
      />

      {/* Компактный режим */}
      {!expanded && (
        <text x={8} y={12} fontSize={7} fill="#94a3b8">
          <tspan fontWeight="600" fill="#cbd5e1">{`Труба-${labelNum}`}</tspan>
          {length ? <tspan fill="#3b82f6"> {length}м</tspan> : null}
          {res?.size ? <tspan fill="#64748b">  {res.size.outer}×{res.size.wall}{pipeShort ? ` ${pipeShort}` : ''}</tspan> : null}
          {res?.flowRate != null ? <tspan fill="#34d399"> {res.flowRate.toFixed(2)}л/м</tspan> : null}
        </text>
      )}

      {/* Развёрнутый режим — столбик */}
      {expanded && lines.map((line, i) => (
        <text
          key={i}
          x={CHIP_PAD_X}
          y={CHIP_PAD_Y + CHIP_FONT + i * CHIP_LINE_H}
          fontSize={CHIP_FONT}
          fontWeight={line.bold ? '600' : '400'}
          fill={line.color}>
          {line.text}
          {line.accent && (
            <tspan fill={line.accentColor} fontWeight="400">{line.accent}</tspan>
          )}
        </text>
      ))}
    </g>
  );
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

function RadiatorSymbol({ sel, props, res, rot }) {
  const s = sel ? '#f87171' : '#ef4444';
  const w = 100, h = 40;
  // Контр-поворот текста: чтобы он всегда оставался горизонтальным
  const textRot = -(rot || 0);
  return (
    <g>
      {/* Корпус радиатора */}
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={3} fill={BG} stroke={s} strokeWidth={sel?2:1.5} />
      {[-32,-16,0,16,32].map(x => (
        <line key={x} x1={x} y1={-h/2+4} x2={x} y2={h/2-4} stroke={s} strokeWidth={2} opacity={0.55} />
      ))}
      {/* Трубка подключения сверху по центру */}
      <line x1={0} y1={-h/2} x2={0} y2={-20} stroke={s} strokeWidth={2} opacity={0.8} />
      {props?.roomName && (
        <text transform={`rotate(${textRot})`} y={-h/2-22} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="600">
          {props.roomName}
        </text>
      )}
      {res?.flowRate != null && (
        <text transform={`rotate(${textRot})`} y={h/2+12} textAnchor="middle" fontSize={7} fill="#34d399">
          Q={res.flowRate.toFixed(2)} л/мин / {(res.flowRate * 0.06).toFixed(3)} м³/ч
        </text>
      )}
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
function GraphNode({ node, sel, res, usedPorts, errorPorts, cappedPorts, inPorts, onMouseDown, onClick, onPortClick, onRotate, onDelete }) {
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

      {sel && (
        <motion.rect
          x={-size.width/2-10} y={-size.height/2-10}
          width={size.width+20} height={size.height+20}
          rx={4} fill="none" stroke="#3b82f6" strokeDasharray="5 3"
          initial={{ opacity: 0, strokeWidth: 0 }}
          animate={{ opacity: 0.7, strokeWidth: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        />
      )}

      <g transform={`rotate(${rot})`}>
        {node.type === 'pump'     && <PumpSymbol     sel={sel} res={res} />}
        {node.type === 'tee'      && <TeeSymbol      sel={sel} />}
        {node.type === 'elbow'    && <ElbowSymbol    sel={sel} />}
        {node.type === 'radiator' && <RadiatorSymbol sel={sel} props={node.props} res={res} rot={rot} />}
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

      {/* Кнопки поворота и удаления */}
      {sel && node.type !== 'pump' && (
        <>
          {/* Поворот — левый верхний угол */}
          <g transform={`translate(${-size.width/2-10},${-size.height/2-10})`}
            onClick={e => { e.stopPropagation(); onRotate(node.id); }}
            style={{ cursor: 'pointer' }}>
            <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#1e293b" stroke="#3b82f6" strokeWidth={1} />
            {/* RotateCw (lucide) — размер 13, центрирован */}
            <g transform="translate(-6.5,-6.5) scale(0.541)" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M 21 2 v 6 h -6" />
              <path d="M 21 13 a 9 9 0 1 1 -3-7.7 L 21 8" />
            </g>
          </g>
          {/* Удаление — правый верхний угол */}
          <g transform={`translate(${size.width/2+10},${-size.height/2-10})`}
            onClick={e => { e.stopPropagation(); onDelete(node.id); }}
            style={{ cursor: 'pointer' }}>
            <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#1e293b" stroke="#1e3a5f" strokeWidth={1} />
            {/* Trash2 lucide SVG (size 13, centered) */}
            <g transform="translate(-6.5,-6.5) scale(0.54)" stroke="#f87171" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <polyline points="3 6 5 6 21 6" />
              <path d="M 19 6 L 18.1 20 A 2 2 0 0 1 16.1 22 H 7.9 A 2 2 0 0 1 5.9 20 L 5 6" />
              <path d="M 9 6 L 9 2 L 15 2 L 15 6" />
              <line x1={10} y1={11} x2={10} y2={17} />
              <line x1={14} y1={11} x2={14} y2={17} />
            </g>
          </g>
        </>
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
  nodes, edges, selectedId, results, openPorts, cappedPorts, inPorts, pipeType,
  onNodeMove, onNodeClick, onPortClick, onRotate, onEdgeClick, onDropElement, onDelete,
}, ref) {
  const svgRef = useRef(null);
  useImperativeHandle(ref, () => svgRef.current, []);

  const [vp, setVp]   = useState({ x: 160, y: 200, scale: 1 });
  const [drag, setDrag] = useState(null);
  const [pan,  setPan]  = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedEdges, setExpandedEdges] = useState(new Set());
  const [guides, setGuides] = useState({ x: null, y: null });
  const guidesTimerRef = useRef(null);

  const toggleEdgeExpand = useCallback((edgeId) => {
    setExpandedEdges(prev => {
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });
  }, []);

  // Сворачиваем чипсины при смене выделения на другую сущность
  useEffect(() => {
    if (selectedId && !expandedEdges.has(selectedId)) {
      setExpandedEdges(new Set());
    }
  }, [selectedId]);

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
      setExpandedEdges(new Set()); // закрываем раскрытую чипсину при клике на фон
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
    let newGuideX = null;
    let newGuideY = null;

    // Snap по портам
    if (movingConfig) {
      outer: for (const [myPortId] of Object.entries(movingConfig)) {
        const myPos = getPortAbsPos(movingNode, myPortId);
        if (!myPos) continue;
        for (const other of nodes) {
          if (other.id === drag.id) continue;
          const otherConfig = NODE_PORT_CONFIG[other.type];
          if (!otherConfig) continue;
          for (const [otherPortId] of Object.entries(otherConfig)) {
            const oPos = getPortAbsPos(other, otherPortId);
            if (!oPos) continue;
            const dist = Math.hypot(myPos.x - oPos.x, myPos.y - oPos.y);
            if (dist < PORT_SNAP_R) {
              nx = nx + (oPos.x - myPos.x);
              ny = ny + (oPos.y - myPos.y);
              newGuideX = oPos.x;
              newGuideY = oPos.y;
              break outer;
            }
          }
        }
      }
    }

    // Направляющие линии (если snap не сработал)
    if (newGuideX === null && newGuideY === null) {
      const GUIDE_R = 10;

      // Вычисляем положение порта перетаскиваемого узла для сравнения
      const movingPortIds = Object.keys(movingConfig || {});

      for (const other of nodes) {
        if (other.id === drag.id) continue;

        if (other.type === 'radiator') {
          // Для радиатора: вспомогательная линия проходит строго через порт
          const portPos = getPortAbsPos(other, 'port');
          if (!portPos) continue;
          let matchX = false, matchY = false;
          for (const pid of movingPortIds) {
            const mp = getPortAbsPos(movingNode, pid);
            if (!mp) continue;
            if (!matchX && Math.abs(mp.x - portPos.x) < GUIDE_R) matchX = true;
            if (!matchY && Math.abs(mp.y - portPos.y) < GUIDE_R) matchY = true;
          }
          if (newGuideX === null && matchX) newGuideX = portPos.x;
          if (newGuideY === null && matchY) newGuideY = portPos.y;
        } else {
          // Для тройников, углов и др.: сравниваем центр other с портами перетаскиваемого узла
          // (если перетаскиваемый — радиатор, используем его порт, иначе центр)
          const movingIsRadiator = movingNode.type === 'radiator';
          if (movingIsRadiator) {
            const portPos = getPortAbsPos(movingNode, 'port');
            if (portPos) {
              if (newGuideX === null && Math.abs(portPos.x - other.x) < GUIDE_R) newGuideX = other.x;
              if (newGuideY === null && Math.abs(portPos.y - other.y) < GUIDE_R) newGuideY = other.y;
            }
          } else {
            if (newGuideX === null && Math.abs(nx - other.x) < GUIDE_R) newGuideX = other.x;
            if (newGuideY === null && Math.abs(ny - other.y) < GUIDE_R) newGuideY = other.y;
          }
        }
      }
    }

    if (guidesTimerRef.current) clearTimeout(guidesTimerRef.current);
    setGuides({ x: newGuideX, y: newGuideY });

    onNodeMove(drag.id, nx, ny);
  }, [pan, drag, vp, nodes, onNodeMove, usedPorts, nodeMap]);

  const handleMouseUp = useCallback(() => {
    setPan(null);
    setDrag(null);
    if (guidesTimerRef.current) clearTimeout(guidesTimerRef.current);
    guidesTimerRef.current = setTimeout(() => setGuides({ x: null, y: null }), 400);
  }, []);

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
    const newId = onDropElement(type, cx, cy);
    // Сразу запускаем drag для нового элемента, чтобы вспомогательные линии работали
    if (newId) {
      setDrag({ id: newId, ox: 0, oy: 0 });
    }
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

        {/* Маска: всё белое (трубы видны), кроме кругов портов (чёрные = вырез) */}
        <mask id="portMask">
          <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
          {nodes.map(node => {
            const config = NODE_PORT_CONFIG[node.type];
            if (!config) return null;
            const rot = node.rotation || 0;
            const rad = rot * Math.PI / 180;
            const cos = Math.round(Math.cos(rad) * 1e9) / 1e9;
            const sin = Math.round(Math.sin(rad) * 1e9) / 1e9;
            return Object.entries(config).map(([pid, p]) => {
              const px = node.x + (p.x * cos - p.y * sin);
              const py = node.y + (p.x * sin + p.y * cos);
              return <circle key={`${node.id}-${pid}`} cx={px} cy={py} r={5} fill="black" />;
            });
          })}
        </mask>
      </defs>

      <rect className="cbg" width="100%" height="100%" fill={BG} />
      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
        {/* Слой 1: трубы (пути) — маска скрывает концы труб внутри портов */}
        <g mask="url(#portMask)">
        {edges.map(edge => {
          const from = nodeMap[edge.fromNodeId];
          const to   = nodeMap[edge.toNodeId];
          if (!from || !to) return null;
          const { supply, ret, center } = edgePaths(from, edge.fromPortId, to, edge.toPortId);
          const res = results?.[edge.id];
          const isSel = selectedId === edge.id;
          const supplyColor = isSel ? '#fca5a5' : '#ef4444';
          const returnColor = isSel ? '#60a5fa' : '#3b82f6';

          return (
            <g key={edge.id} onClick={e => { e.stopPropagation(); onEdgeClick(edge.id); }}
              style={{ cursor: 'pointer' }}>
              <path d={center} stroke="transparent" strokeWidth={20} fill="none" />
              <path d={center} stroke="#000" strokeWidth={7} fill="none" strokeLinecap="butt" opacity={0.2} />
              <path d={ret}    stroke={returnColor} strokeWidth={isSel ? 2.5 : 1.8} fill="none" strokeLinecap="butt" />
              <path d={supply} stroke={supplyColor} strokeWidth={isSel ? 2.5 : 1.8} fill="none" strokeLinecap="butt" />
              {isSel && (
                <motion.path
                  d={center} fill="none" strokeLinecap="round"
                  stroke="#3b82f6"
                  initial={{ strokeWidth: 0, opacity: 0 }}
                  animate={{ strokeWidth: 6, opacity: 0.13 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                />
              )}
            </g>
          );
        })}
        </g>

        {/* Слой 2: узлы */}
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
            onDelete={onDelete}
          />
        ))}

        {/* Слой 3.5: направляющие линии (snap guides) */}
        {guides.x !== null && (
          <line x1={guides.x} y1={-10000} x2={guides.x} y2={10000}
            stroke="#4ade80" strokeWidth={0.8} strokeDasharray="4 4" opacity={0.8}
            style={{ pointerEvents: 'none' }} />
        )}
        {guides.y !== null && (
          <line x1={-10000} y1={guides.y} x2={10000} y2={guides.y}
            stroke="#4ade80" strokeWidth={0.8} strokeDasharray="4 4" opacity={0.8}
            style={{ pointerEvents: 'none' }} />
        )}

        {/* Слой 3: чипсины труб — поверх всех узлов */}
        {edges.map(edge => {
          const from = nodeMap[edge.fromNodeId];
          const to   = nodeMap[edge.toNodeId];
          if (!from || !to) return null;
          const mid = pathMidpoint(from, edge.fromPortId, to, edge.toPortId);

          if (!mid) return null;
          const res = results?.[edge.id];
          const isExp = expandedEdges.has(edge.id);
          const labelNum = edgeNumbers[edge.id] ?? '?';

          return (
            <g key={`chip-${edge.id}`} transform={`translate(${mid.x},${mid.y})`}>
              <EdgeChip
                edge={edge}
                res={res}
                labelNum={labelNum}
                expanded={isExp}
                pipeType={pipeType}
                onToggle={() => {
                  const wasExp = expandedEdges.has(edge.id);
                  // закрываем все, открываем только эту (или закрываем если уже открыта)
                  setExpandedEdges(wasExp ? new Set() : new Set([edge.id]));
                  if (!wasExp) onEdgeClick(edge.id);
                }}
              />
            </g>
          );
        })}
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