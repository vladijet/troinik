import { useRef, useState, useCallback } from 'react';
import { ELEMENT_TYPES, getPortAbsPos } from './elementConfig';
import CanvasElement from './CanvasElement';
import { snapToGrid, GRID } from './isoUtils';

function dirCtrl(dir, dist) {
  if (dir === 'right') return { x: dist,  y: 0     };
  if (dir === 'left')  return { x: -dist, y: 0     };
  if (dir === 'down')  return { x: 0,     y: dist  };
  return                      { x: 0,     y: -dist };
}

function oppDir(dir) {
  return { right: 'left', left: 'right', down: 'up', up: 'down' }[dir] || 'left';
}

function connectionPath(fromEl, fromPortId, toEl, toPortId) {
  const from = getPortAbsPos(fromEl, fromPortId);
  const to   = getPortAbsPos(toEl,   toPortId);
  if (!from || !to) return '';
  const dist = Math.max(50, Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2) * 0.35);
  const c1 = dirCtrl(from.dir, dist);
  const c2 = dirCtrl(oppDir(to.dir), dist);
  return `M ${from.x} ${from.y} C ${from.x + c1.x} ${from.y + c1.y} ${to.x + c2.x} ${to.y + c2.y} ${to.x} ${to.y}`;
}

// Compute pipe color based on direction (supply=warm, return=cool)
function pipeStrokeColor(fromEl, toEl) {
  if (!fromEl || !toEl) return '#3b82f6';
  return '#3b82f6';
}

export default function Canvas({
  elements, connections, activePort, selectedId, results,
  onElementMove, onElementClick, onPortClick, onRotate
}) {
  const svgRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 120, y: 80, scale: 1 });
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);

  const elMap = {};
  elements.forEach(e => (elMap[e.id] = e));

  function getSVGCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function screenToCanvas(sx, sy) {
    return {
      x: (sx - viewport.x) / viewport.scale,
      y: (sy - viewport.y) / viewport.scale,
    };
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(4, viewport.scale * factor));
    setViewport(v => ({
      x: x - (x - v.x) * (newScale / v.scale),
      y: y - (y - v.y) * (newScale / v.scale),
      scale: newScale,
    }));
  }, [viewport]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const { x, y } = getSVGCoords(e);
    const target = e.target;
    if (target === svgRef.current || target.closest('.canvas-bg')) {
      setPanning({ startX: x - viewport.x, startY: y - viewport.y });
      onElementClick(null);
    }
  }, [viewport, onElementClick]);

  const handleMouseMove = useCallback((e) => {
    const { x, y } = getSVGCoords(e);
    if (panning) {
      setViewport(v => ({ ...v, x: x - panning.startX, y: y - panning.startY }));
    }
    if (dragging) {
      const cp = screenToCanvas(x, y);
      const snapped = {
        x: snapToGrid(cp.x - dragging.ox),
        y: snapToGrid(cp.y - dragging.oy),
      };
      onElementMove(dragging.elId, snapped.x, snapped.y);
    }
  }, [panning, dragging, viewport, onElementMove]);

  const handleMouseUp = useCallback(() => {
    setPanning(null);
    setDragging(null);
  }, []);

  const startDrag = useCallback((e, elId) => {
    e.stopPropagation();
    const { x, y } = getSVGCoords(e);
    const cp = screenToCanvas(x, y);
    const el = elements.find(el => el.id === elId);
    setDragging({ elId, ox: cp.x - el.x, oy: cp.y - el.y });
  }, [elements, viewport]);

  // Isometric grid — diamond pattern
  const gridSpacing = GRID * viewport.scale;
  const gox = ((viewport.x % gridSpacing) + gridSpacing) % gridSpacing;
  const goy = ((viewport.y % gridSpacing) + gridSpacing) % gridSpacing;
  const dotR = Math.max(0.5, viewport.scale * 0.4);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ cursor: panning ? 'grabbing' : 'default', background: '#0f172a' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <defs>
        {/* dot grid */}
        <pattern id="isoGrid" patternUnits="userSpaceOnUse" x={gox} y={goy} width={gridSpacing} height={gridSpacing}>
          <circle cx={dotR} cy={dotR} r={dotR} fill="#1e3a5f" opacity={0.8} />
        </pattern>
        {/* pipe gradients */}
        <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.9" />
        </linearGradient>
        {/* glow filter for selected */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect className="canvas-bg" width="100%" height="100%" fill="#0f172a" />
      <rect width="100%" height="100%" fill="url(#isoGrid)" />

      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
        {/* Connections */}
        {connections.map(conn => {
          const fromEl = elMap[conn.fromElementId];
          const toEl   = elMap[conn.toElementId];
          if (!fromEl || !toEl) return null;
          const d = connectionPath(fromEl, conn.fromPortId, toEl, conn.toPortId);
          const from = getPortAbsPos(fromEl, conn.fromPortId);
          const to   = getPortAbsPos(toEl, conn.toPortId);
          return (
            <g key={conn.id}>
              {/* shadow */}
              <path d={d} stroke="#000" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.3} />
              {/* pipe body */}
              <path d={d} stroke="#3b82f6" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.9} />
              {/* highlight */}
              <path d={d} stroke="#93c5fd" strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.4} />
              {/* flow arrows */}
              {from && to && (
                <path
                  d={`M ${(from.x + to.x) / 2 - 4} ${(from.y + to.y) / 2}
                      L ${(from.x + to.x) / 2 + 4} ${(from.y + to.y) / 2 - 4}
                      L ${(from.x + to.x) / 2 + 4} ${(from.y + to.y) / 2 + 4} Z`}
                  fill="#60a5fa" opacity={0.5}
                />
              )}
            </g>
          );
        })}

        {/* Elements */}
        {elements.map(el => (
          <CanvasElement
            key={el.id}
            element={el}
            selected={selectedId === el.id}
            results={results?.[el.id]}
            activePort={activePort}
            connections={connections}
            onMouseDown={e => startDrag(e, el.id)}
            onClick={e => { e.stopPropagation(); onElementClick(el.id); }}
            onPortClick={onPortClick}
            onRotate={onRotate}
          />
        ))}
      </g>

      {/* Scale indicator */}
      <g transform="translate(16, 16)">
        <rect width={80} height={18} rx={4} fill="#1e293b" opacity={0.8} />
        <text x={8} y={13} fontSize={9} fill="#64748b">
          {(viewport.scale * 100).toFixed(0)}% | ПКМ — пан
        </text>
      </g>
    </svg>
  );
}