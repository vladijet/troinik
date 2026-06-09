export default function ElementPanel({ onAddElement }) {
  const items = [
    {
      type: 'pipe',
      label: 'Труба',
      svg: (
        <svg viewBox="-50 -18 100 36" width={52} height={28}>
          <rect x={-44} y={-11} width={88} height={22} rx={5} fill="#f8fafc" stroke="#64748b" strokeWidth={1.5} />
          <text textAnchor="middle" fontSize={9} fill="#64748b" dy={4}>L= м</text>
        </svg>
      ),
    },
    {
      type: 'tee',
      label: 'Тройник',
      svg: (
        <svg viewBox="-44 -20 88 60" width={52} height={44}>
          <rect x={-40} y={-12} width={80} height={22} rx={4} fill="#f8fafc" stroke="#475569" strokeWidth={1.5} />
          <rect x={-10} y={10} width={20} height={22} rx={4} fill="#f8fafc" stroke="#475569" strokeWidth={1.5} />
        </svg>
      ),
    },
    {
      type: 'elbow',
      label: 'Угол 90°',
      svg: (
        <svg viewBox="-34 -14 56 50" width={44} height={44}>
          <rect x={-30} y={-10} width={40} height={20} rx={4} fill="#f8fafc" stroke="#475569" strokeWidth={1.5} />
          <rect x={-10} y={10} width={20} height={22} rx={4} fill="#f8fafc" stroke="#475569" strokeWidth={1.5} />
        </svg>
      ),
    },
    {
      type: 'radiator',
      label: 'Радиатор',
      svg: (
        <svg viewBox="-62 -26 124 52" width={56} height={36}>
          <rect x={-60} y={-22} width={120} height={44} rx={5} fill="#fff7ed" stroke="#f97316" strokeWidth={1.5} />
          {[-30, -15, 0, 15, 30].map(lx => (
            <line key={lx} x1={lx} y1={-14} x2={lx} y2={14} stroke="#fed7aa" strokeWidth={2.5} />
          ))}
        </svg>
      ),
    },
  ];

  return (
    <div className="w-20 bg-white border-r border-slate-200 flex flex-col items-center gap-1 py-3 shrink-0 overflow-y-auto">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 text-center leading-tight">
        Элементы
      </p>
      {items.map(item => (
        <button
          key={item.type}
          onClick={() => onAddElement(item.type)}
          title={item.label}
          className="w-16 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          {item.svg}
          <span className="text-[9px] text-slate-500 text-center leading-tight">{item.label}</span>
        </button>
      ))}
    </div>
  );
}