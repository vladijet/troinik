import { useRef, useState, useCallback } from 'react';
import { ELEMENT_TYPES, getPortAbsPos } from './elementConfig';
import CanvasElement from './CanvasElement';

function dirCtrl(dir, dist) {
  if (dir === 'right') return { x: dist, y: 0 };
  if (dir === 'left')  return { x: -dist, y: 0 };
  if (dir === 'down')  return { x: 0, y: dist };
  return { x: 0, y: -dist };
}

function oppDir(dir) {
  return { right: 'left', left: 'right', down: 'up', up: 'down' }[dir] || 'left';
}

function connectionPath(fromEl, fromPortId, toEl, toPortId) {
  const from = getPortAbsPos(fromEl, fromPortId);
  const to   = getPortAbsPos(toEl,   toPortId);
  if (!from || !to) return '';
  const dist = Math.max(50, Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2) * 0.4);
  const c1 = dirCtrl(from.dir, dist);
  const c2 = dirCtrl(oppDir(to.dir), dist);
  return `M ${from.x} ${from.y} C ${from.x + c1.x} ${from.y + c1.y} ${to.x + c2.x} ${to.y + c2.y} ${to.x} ${to.y}`;
}

export default function Canvas({ elements, connections, activePort, selectedId, results, onElementMove, onElementClick, onPortClick }) {
  const svgRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 80, y: 60, scale: 1 });
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);

  const elMap = {};
  elements.forEach(e => (elMap[e.id] = e));

  function getSVGCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function screenToCanvas(sx, sy) {
    return { x: (sx - viewport.x) / viewport.scale, y: (sy - viewport.y) / viewport.scale };
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
      onElementMove(dragging.elId, cp.x - dragging.ox, cp.y - dragging.oy);
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

  const gridSize = 24 * viewport.scale;
  const gox = ((viewport.x % gridSize) + gridSize) % gridSize;
  const goy = ((viewport.y % gridSize) + gridSize) % gridSize;
  const dotR = Math.max(0.4, viewport.scale * 0.35);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ cursor: panning ? 'grabbing' : 'default', background: '#f8fafc' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <defs>
        <pattern id="dotGrid" patternUnits="userSpaceOnUse" x={gox} y={goy} width={gridSize} height={gridSize}>
          <circle cx={dotR} cy={dotR} r={dotR} fill="#cbd5e1" />
        </pattern>
      </defs>
      <rect className="canvas-bg" width="100%" height="100%" fill="url(#dotGrid)" />

      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
        {/* Connections */}
        {connections.map(conn => {
          const fromEl = elMap[conn.fromElementId];
          const toEl = elMap[conn.toElementId];
          if (!fromEl || !toEl) return null;
          const d = connectionPath(fromEl, conn.fromPortId, toEl, conn.toPortId);
          return (
            <path key={conn.id} d={d} stroke="#64748b" strokeWidth={2} fill="none" strokeLinecap="round" />
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
          />
        ))}
      </g>
    </svg>
  );
}