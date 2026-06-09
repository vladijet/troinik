/**
 * GraphInspector — property panel for selected hydraulic node
 */
import { useState } from 'react';
import { Trash2, Info, AlertCircle, RotateCw } from 'lucide-react';

const dark = {
  bg: '#0f172a', card: '#1e293b', border: '#1e3a5f',
  text: '#94a3b8', textBright: '#e2e8f0', textMuted: '#475569',
  accent: '#3b82f6', success: '#34d399', warn: '#fbbf24', danger: '#f87171',
};

const NODE_LABELS = { pump: 'Насос', pipe: 'Труба', tee: 'Тройник', elbow: 'Угол 90°', radiator: 'Радиатор' };
const NODE_COLORS = { pump: '#a78bfa', pipe: '#3b82f6', tee: '#10b981', elbow: '#f59e0b', radiator: '#ef4444' };

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label style={{ fontSize: 10, color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StyledInput(props) {
  return (
    <input {...props} style={{
      width: '100%', height: 32, padding: '0 8px',
      background: dark.bg, border: `1px solid ${dark.border}`,
      borderRadius: 6, color: dark.textBright, fontSize: 12,
      outline: 'none', ...props.style,
    }} />
  );
}

function ResultRow({ label, value, unit, color }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center" style={{ fontSize: 11 }}>
      <span style={{ color: dark.textMuted }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: color || dark.success }}>
        {value} <span style={{ color: dark.textMuted, fontWeight: 400 }}>{unit}</span>
      </span>
    </div>
  );
}

export default function GraphInspector({ node, results, onUpdate, onDelete, onRotate }) {
  const [flowWarning, setFlowWarning] = useState(false);

  if (!node) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center gap-3">
        <Info className="w-7 h-7" style={{ color: dark.textMuted }} />
        <p style={{ fontSize: 11, color: dark.textMuted, lineHeight: 1.6 }}>
          Выберите элемент на схеме для просмотра и редактирования параметров
        </p>
      </div>
    );
  }

  const color = NODE_COLORS[node.type] || dark.accent;
  const label = NODE_LABELS[node.type] || node.type;

  return (
    <div className="p-3 space-y-3" style={{ color: dark.text }}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: dark.textBright }}>{label}</span>
          </div>
          <p style={{ fontSize: 9, color: dark.textMuted, marginTop: 2 }}>{node.id}</p>
        </div>
        <div className="flex gap-1">
          {node.type !== 'pump' && onRotate && (
            <button onClick={() => onRotate(node.id)} title="Повернуть 90°" style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              background: dark.card, border: `1px solid ${dark.border}`, color: dark.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RotateCw size={13} />
            </button>
          )}
          {node.type !== 'pump' && (
            <button onClick={onDelete} style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              background: dark.card, border: `1px solid ${dark.border}`, color: dark.danger,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: dark.border }} />

      {/* Rotation info */}
      {node.type !== 'pump' && (
        <div style={{
          fontSize: 10, color: dark.textMuted, background: dark.card,
          borderRadius: 6, padding: '4px 8px', border: `1px solid ${dark.border}`,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Поворот</span>
          <span style={{ color: dark.accent, fontWeight: 700 }}>{node.rotation || 0}°</span>
        </div>
      )}

      {/* Pipe props */}
      {node.type === 'pipe' && (
        <Field label="Длина, м">
          <StyledInput type="number" value={node.props?.length ?? ''}
            onChange={e => onUpdate({ length: parseFloat(e.target.value) || '' })}
            step={0.5} min={0.1} placeholder="1.0" />
        </Field>
      )}

      {/* Radiator props */}
      {node.type === 'radiator' && (
        <>
          <Field label="Помещение">
            <StyledInput type="text" value={node.props?.roomName ?? ''}
              onChange={e => onUpdate({ roomName: e.target.value })}
              placeholder="Гостиная..." />
          </Field>
          <div style={{ fontSize: 9, color: dark.textMuted, textAlign: 'center', padding: '2px 0' }}>
            — расход ИЛИ мощность —
          </div>
          {flowWarning && (
            <div className="flex items-center gap-1" style={{
              fontSize: 10, color: dark.warn, background: '#292100',
              borderRadius: 6, padding: '4px 8px', border: `1px solid ${dark.warn}33`,
            }}>
              <AlertCircle size={12} /> Минимум: 0.65 л/мин
            </div>
          )}
          <Field label="Расход, л/мин">
            <StyledInput type="number" value={node.props?.flowRate ?? ''}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (val > 0 && val < 0.65) { onUpdate({ flowRate: 0.65, power: '' }); setFlowWarning(true); }
                else { onUpdate({ flowRate: e.target.value, power: '' }); setFlowWarning(false); }
              }}
              step={0.1} min={0} placeholder="0.65" />
          </Field>
          <Field label="Мощность при ΔT=70°, Вт">
            <StyledInput type="number" value={node.props?.power ?? ''}
              onChange={e => { onUpdate({ power: e.target.value, flowRate: '' }); setFlowWarning(false); }}
              step={100} min={0} placeholder="1000" />
          </Field>
        </>
      )}

      {/* Results */}
      {results && (
        <>
          <div style={{ height: 1, background: dark.border }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: dark.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Результаты расчёта
          </p>
          <div className="space-y-1.5">
            {node.type === 'pump' && <>
              <ResultRow label="Расход Q"  value={results.flowRate?.toFixed(1)} unit="л/мин" color={dark.accent} />
              <ResultRow label="Напор H"   value={results.head?.toFixed(2)}     unit="м вод.ст." />
              <ResultRow label="ΔP насоса" value={(results.pressure / 1000)?.toFixed(2)} unit="кПа" color="#a78bfa" />
            </>}
            {node.type === 'pipe' && <>
              <ResultRow label="Диаметр" value={results.size ? `Ø${results.size.outer}×${results.size.wall}` : '—'} unit="мм" />
              <ResultRow label="Скорость" value={results.velocity?.toFixed(3)} unit="м/с" color={dark.warn} />
              <ResultRow label="ΔP" value={results.pressureLoss?.toFixed(1)} unit="Па" color={dark.warn} />
              <ResultRow label="Расход" value={results.flowRate?.toFixed(2)} unit="л/мин" />
            </>}
            {node.type === 'tee' && <>
              <ResultRow label="Диаметр"      value={results.size ? `Ø${results.size.outer}` : '—'} unit="мм" />
              <ResultRow label="ΔP прямой"    value={results.pressureLossPass?.toFixed(1)} unit="Па" />
              <ResultRow label="ΔP ответвл."  value={results.pressureLossBranch?.toFixed(1)} unit="Па" />
              <ResultRow label="Расход общий" value={results.flowRate?.toFixed(2)} unit="л/мин" />
            </>}
            {node.type === 'elbow' && <>
              <ResultRow label="Диаметр"  value={results.size ? `Ø${results.size.outer}` : '—'} unit="мм" />
              <ResultRow label="ΔP"       value={results.pressureLoss?.toFixed(1)} unit="Па" color={dark.warn} />
              <ResultRow label="Расход"   value={results.flowRate?.toFixed(2)} unit="л/мин" />
            </>}
            {node.type === 'radiator' && <>
              <ResultRow label="Расход"   value={results.flowRate?.toFixed(3)} unit="л/мин" />
              <ResultRow label="Диаметр подвода" value={results.size ? `Ø${results.size.outer}` : '—'} unit="мм" />
              <ResultRow label="ΔP (арматура)" value={results.pressureLoss?.toFixed(1)} unit="Па" color={dark.warn} />
            </>}
          </div>
        </>
      )}
    </div>
  );
}