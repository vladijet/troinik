import { COLORS } from './isoUtils';

const ITEMS = [
  {
    type: 'pipe',
    label: 'Труба',
    svg: (
      <svg viewBox="-52 -18 104 36" width={56} height={28}>
        {/* top */}
        <polygon points="-44,-14 44,-14 36,-22 -52,-22" fill="#2d5a8e" />
        {/* right */}
        <polygon points="44,-14 44,14 36,6 36,-22" fill="#0f2040" />
        {/* front */}
        <rect x={-44} y={-14} width={88} height={28} rx={4} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1.5} />
        <line x1={-36} y1={0} x2={36} y2={0} stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
        <text textAnchor="middle" fontSize={8} fill="#93c5fd" dy={4} fontWeight="600">ТРУБА</text>
      </svg>
    ),
  },
  {
    type: 'tee',
    label: 'Тройник',
    svg: (
      <svg viewBox="-44 -22 88 66" width={52} height={52}>
        {/* horizontal top */}
        <polygon points="-40,-14 40,-14 32,-22 -48,-22" fill="#2d6b4f" />
        <polygon points="40,-14 40,14 32,6 32,-22" fill="#0e2418" />
        <rect x={-40} y={-14} width={80} height={28} rx={4} fill="#1a3d2e" stroke="#10b981" strokeWidth={1.5} />
        {/* branch top */}
        <polygon points="-10,14 10,14 2,6 -18,6" fill="#2d6b4f" />
        <polygon points="10,14 10,42 2,34 2,6" fill="#0e2418" />
        <rect x={-10} y={14} width={20} height={28} rx={4} fill="#1a3d2e" stroke="#10b981" strokeWidth={1.5} />
        <text textAnchor="middle" fontSize={7} fill="#6ee7b7" dy={4} fontWeight="600">ТЕЕ</text>
      </svg>
    ),
  },
  {
    type: 'elbow',
    label: 'Угол 90°',
    svg: (
      <svg viewBox="-38 -22 68 60" width={48} height={52}>
        {/* horizontal */}
        <polygon points="-30,-14 10,-14 2,-22 -38,-22" fill="#6b4423" />
        <polygon points="10,-14 10,14 2,6 2,-22" fill="#241508" />
        <rect x={-30} y={-14} width={40} height={28} rx={4} fill="#3d2a1a" stroke="#f59e0b" strokeWidth={1.5} />
        {/* vertical */}
        <polygon points="-10,14 10,14 2,6 -18,6" fill="#6b4423" />
        <polygon points="10,14 10,38 2,30 2,6" fill="#241508" />
        <rect x={-10} y={14} width={20} height={24} rx={4} fill="#3d2a1a" stroke="#f59e0b" strokeWidth={1.5} />
        <text x={14} y={-16} fontSize={7} fill="#fcd34d" fontWeight="600">90°</text>
      </svg>
    ),
  },
  {
    type: 'radiator',
    label: 'Радиатор',
    svg: (
      <svg viewBox="-64 -28 128 60" width={64} height={52}>
        {/* top */}
        <polygon points="-60,-24 60,-24 48,-36 -72,-36" fill="#7a2f2f" />
        {/* right */}
        <polygon points="60,-24 60,24 48,12 48,-36" fill="#240a0a" />
        {/* front */}
        <rect x={-60} y={-24} width={120} height={48} rx={5} fill="#3d1a1a" stroke="#ef4444" strokeWidth={1.5} />
        {[-36, -20, -4, 12, 28].map(lx => (
          <line key={lx} x1={lx} y1={-16} x2={lx} y2={16} stroke="#ef4444" strokeWidth={2.5} opacity={0.7} />
        ))}
        <text textAnchor="middle" fontSize={7} fill="#fca5a5" dy={26} fontWeight="600">РАДИАТОР</text>
      </svg>
    ),
  },
];

export default function ElementPanel({ onAddElement }) {
  return (
    <div className="w-[76px] flex flex-col items-center gap-1.5 py-3 shrink-0 overflow-y-auto"
      style={{ background: '#0f172a', borderRight: '1px solid #1e3a5f' }}>
      <p className="text-[9px] uppercase tracking-widest mb-1 text-center leading-tight"
        style={{ color: '#334155' }}>
        ЭЛЕМЕНТЫ
      </p>
      {ITEMS.map(item => (
        <button
          key={item.type}
          onClick={() => onAddElement(item.type)}
          title={item.label}
          className="w-[64px] flex flex-col items-center gap-0.5 py-2 px-1 rounded transition-all"
          style={{
            background: '#1e293b',
            border: '1px solid #1e3a5f',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.background = '#1e3a5f';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1e3a5f';
            e.currentTarget.style.background = '#1e293b';
          }}
        >
          {item.svg}
          <span className="text-[8px] text-center leading-tight mt-0.5" style={{ color: '#64748b' }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}