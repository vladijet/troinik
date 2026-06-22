/**
 * ElementPanel — только компоненты (без трубы, она создаётся автоматически как ребро)
 */
const ITEMS = [
  {
    type: 'tee', label: 'Тройник',
    svg: (
      <svg viewBox="-32 -20 64 56" width={48} height={44}>
        <line x1={-28} y1={0} x2={28}  y2={0}  stroke="#10b981" strokeWidth={3} strokeLinecap="round" />
        <line x1={0}   y1={0} x2={0}   y2={28} stroke="#10b981" strokeWidth={3} strokeLinecap="round" />
        <circle r={4} fill="#10b981" />
        <circle cx={-28} cy={0}  r={3.5} fill="#4ade80" />
        <circle cx={ 28} cy={0}  r={3.5} fill="#4ade80" />
        <circle cx={0}  cy={28} r={3.5} fill="#4ade80" />
      </svg>
    ),
  },
  {
    type: 'elbow', label: 'Угол 90°',
    svg: (
      <svg viewBox="-32 -20 60 56" width={44} height={48}>
        <path d="M -28,0 L 0,0 L 0,28" fill="none" stroke="#10b981" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle r={4} fill="#10b981" />
        <circle cx={-28} cy={0}  r={3.5} fill="#4ade80" />
        <circle cx={0}   cy={28} r={3.5} fill="#4ade80" />
        <text x={6} y={-8} fontSize={8} fill="#64748b">90°</text>
      </svg>
    ),
  },
  {
    type: 'radiator', label: 'Радиатор',
    svg: (
      <svg viewBox="-56 -28 112 60" width={60} height={48}>
        <rect x={-50} y={-20} width={100} height={40} rx={3} fill="#0f172a" stroke="#ef4444" strokeWidth={1.5} />
        {[-30,-14,2,18,34].map(x => (
          <line key={x} x1={x} y1={-14} x2={x} y2={14} stroke="#ef4444" strokeWidth={2} opacity={0.6} />
        ))}
        <circle cx={-50} cy={0} r={3.5} fill="#f87171" />
        <circle cx={ 50} cy={0} r={3.5} fill="#f87171" />
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
      <p className="text-[8px] text-center leading-tight px-1 mb-2" style={{ color: '#1e3a5f' }}>
        Труба — автоматически при соединении
      </p>
      {ITEMS.map(item => (
        <button key={item.type}
          onClick={() => onAddElement(item.type)}
          title={item.label}
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('elementType', item.type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          className="w-[64px] flex flex-col items-center gap-0.5 py-2 px-1 rounded transition-all cursor-grab active:cursor-grabbing"
          style={{ background: '#1e293b', border: '1px solid #1e3a5f' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#1e3a5f'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.background = '#1e293b'; }}
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