/**
 * ElementPanel — sidebar with schematic-style element icons
 */
const ITEMS = [
  {
    type: 'pipe',
    label: 'Труба',
    svg: (
      <svg viewBox="-52 -16 104 32" width={58} height={28}>
        <line x1={-44} y1={-5} x2={44} y2={-5} stroke="#3b82f6" strokeWidth={2} />
        <line x1={-44} y1={ 5} x2={44} y2={ 5} stroke="#3b82f6" strokeWidth={2} />
        <line x1={-44} y1={-8} x2={-44} y2={8} stroke="#3b82f6" strokeWidth={2} />
        <line x1={ 44} y1={-8} x2={ 44} y2={8} stroke="#3b82f6" strokeWidth={2} />
        <line x1={-44} y1={0} x2={44} y2={0} stroke="#3b82f6" strokeWidth={0.8} strokeDasharray="7 4" opacity={0.4} />
        <path d="M -5,0 L 5,-4 L 5,4 Z" fill="#3b82f6" opacity={0.7} />
      </svg>
    ),
  },
  {
    type: 'tee',
    label: 'Тройник',
    svg: (
      <svg viewBox="-44 -16 88 56" width={52} height={52}>
        <line x1={-40} y1={-5} x2={40} y2={-5} stroke="#10b981" strokeWidth={2} />
        <line x1={-40} y1={ 5} x2={40} y2={ 5} stroke="#10b981" strokeWidth={2} />
        <line x1={-40} y1={-8} x2={-40} y2={8} stroke="#10b981" strokeWidth={2} />
        <line x1={ 40} y1={-8} x2={ 40} y2={8} stroke="#10b981" strokeWidth={2} />
        <line x1={-5} y1={5} x2={-5} y2={36} stroke="#10b981" strokeWidth={2} />
        <line x1={ 5} y1={5} x2={ 5} y2={36} stroke="#10b981" strokeWidth={2} />
        <line x1={-8} y1={36} x2={8} y2={36} stroke="#10b981" strokeWidth={2} />
      </svg>
    ),
  },
  {
    type: 'elbow',
    label: 'Угол 90°',
    svg: (
      <svg viewBox="-36 -16 64 56" width={44} height={48}>
        <line x1={-30} y1={-5} x2={0} y2={-5} stroke="#f59e0b" strokeWidth={2} />
        <line x1={-30} y1={ 5} x2={0} y2={ 5} stroke="#f59e0b" strokeWidth={2} />
        <line x1={-30} y1={-8} x2={-30} y2={8} stroke="#f59e0b" strokeWidth={2} />
        <line x1={-5} y1={0} x2={-5} y2={30} stroke="#f59e0b" strokeWidth={2} />
        <line x1={ 5} y1={0} x2={ 5} y2={30} stroke="#f59e0b" strokeWidth={2} />
        <line x1={-8} y1={30} x2={8} y2={30} stroke="#f59e0b" strokeWidth={2} />
        <path d="M -5,0 Q 5,0 5,10" fill="none" stroke="#f59e0b" strokeWidth={2} />
        <text x={8} y={-6} fontSize={7} fill="#fcd34d">90°</text>
      </svg>
    ),
  },
  {
    type: 'radiator',
    label: 'Радиатор',
    svg: (
      <svg viewBox="-64 -28 128 56" width={64} height={48}>
        <rect x={-56} y={-20} width={112} height={40} rx={3} fill="#0f172a" stroke="#ef4444" strokeWidth={1.5} />
        {[-36, -20, -4, 12, 28].map(lx => (
          <line key={lx} x1={lx} y1={-14} x2={lx} y2={14} stroke="#ef4444" strokeWidth={2} opacity={0.7} />
        ))}
        <path d="M 44,-8 Q 48,-4 44,0 Q 40,4 44,8" stroke="#ef4444" strokeWidth={1} fill="none" opacity={0.6} />
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
        <button key={item.type} onClick={() => onAddElement(item.type)} title={item.label}
          className="w-[64px] flex flex-col items-center gap-0.5 py-2 px-1 rounded transition-all"
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