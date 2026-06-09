// Isometric projection utilities
// Logical grid: X = right, Y = down, Z = up (floors)
// Screen: isometric projection with 30° angles

const ISO_SCALE_X = 28; // pixels per grid unit horizontal
const ISO_SCALE_Y = 16; // pixels per grid unit vertical

export const GRID = 24; // logical grid step in px (snap)

// Convert logical canvas coords to isometric screen coords
export function toIso(lx, ly) {
  return {
    sx: lx,
    sy: ly,
  };
}

// Snap a value to grid
export function snapToGrid(v, grid = GRID) {
  return Math.round(v / grid) * grid;
}

// Snap point to nearest port of any element (within threshold)
export function snapToPort(x, y, elements, skipId, getPortAbsPos, ELEMENT_TYPES) {
  const SNAP_DIST = 28;
  let best = null;
  let bestDist = Infinity;

  elements.forEach(el => {
    if (el.id === skipId) return;
    const cfg = ELEMENT_TYPES[el.type];
    if (!cfg) return;
    Object.entries(cfg.ports).forEach(([portId, p]) => {
      const abs = getPortAbsPos(el, portId);
      if (!abs) return;
      const d = Math.hypot(abs.x - x, abs.y - y);
      if (d < SNAP_DIST && d < bestDist) {
        bestDist = d;
        best = { el, portId, abs };
      }
    });
  });

  return best;
}

// Element color theme
export const COLORS = {
  pipe:     { fill: '#1e3a5f', side: '#0f2040', top: '#2d5a8e', stroke: '#3b82f6', label: '#93c5fd' },
  tee:      { fill: '#1a3d2e', side: '#0e2418', top: '#2d6b4f', stroke: '#10b981', label: '#6ee7b7' },
  elbow:    { fill: '#3d2a1a', side: '#241508', top: '#6b4423', stroke: '#f59e0b', label: '#fcd34d' },
  radiator: { fill: '#3d1a1a', side: '#240a0a', top: '#7a2f2f', stroke: '#ef4444', label: '#fca5a5' },
  pump:     { fill: '#1a1a3d', side: '#0a0a24', top: '#2d2d7a', stroke: '#8b5cf6', label: '#c4b5fd' },
};