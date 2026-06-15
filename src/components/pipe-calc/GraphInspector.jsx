/**
 * GraphInspector — панель свойств выбранного узла или ребра (трубы)
 * Каждое ребро = двухтрубная магистраль (подача + обратка).
 * Длина одна — движок удваивает автоматически.
 */
import { useState } from 'react';
import { Trash2, Info, AlertCircle, RotateCw } from 'lucide-react';

const D = {
  bg: '#0f172a', card: '#1e293b', border: '#1e3a5f',
  text: '#94a3b8', bright: '#e2e8f0', muted: '#475569',
  accent: '#3b82f6', green: '#34d399', warn: '#fbbf24', red: '#f87171',
};

const NODE_LABELS = { pump: 'Насос', tee: 'Тройник', elbow: 'Угол 90°', radiator: 'Радиатор' };
const NODE_COLORS = { pump: '#a78bfa', tee: '#10b981', elbow: '#f59e0b', radiator: '#ef4444' };

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

function SInput(props) {
  return <input {...props} style={{
    width: '100%', height: 30, padding: '0 8px',
    background: D.bg, border: `1px solid ${D.border}`,
    borderRadius: 5, color: D.bright, fontSize: 12, outline: 'none', ...props.style,
  }} />;
}

function Row({ label, value, unit, color }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center" style={{ fontSize: 11 }}>
      <span style={{ color: D.muted }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: color || D.green }}>
        {value} <span style={{ color: D.muted, fontWeight: 400 }}>{unit}</span>
      </span>
    </div>
  );
}

// Инспектор ребра — двухтрубная магистраль
function EdgePanel({ edge, res, onUpdateEdge, onDeleteEdge }) {
  const length = edge.pipeProps?.length ?? '';

  return (
    <div className="p-3 space-y-3" style={{ color: D.text }}>
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            {/* Иконка двойной трубы: синяя + красная */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: 20, height: 2, background: '#ef4444', borderRadius: 1 }} />
              <div style={{ width: 20, height: 2, background: '#3b82f6', borderRadius: 1 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: D.bright }}>Магистраль</span>
          </div>
          <p style={{ fontSize: 9, color: D.muted, marginTop: 2 }}>{edge.id} · подача + обратка</p>
        </div>
        <button onClick={onDeleteEdge} style={{
          width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
          background: D.card, border: `1px solid ${D.border}`, color: D.red,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trash2 size={13} />
        </button>
      </div>

      <div style={{ height: 1, background: D.border }} />

      {/* Подсказка о двухтрубной модели */}
      <div style={{ background: '#0a1929', border: `1px solid #1e3a5f`, borderRadius: 5, padding: '6px 8px' }}>
        <p style={{ fontSize: 9, color: D.muted, lineHeight: 1.5, margin: 0 }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>▶ подача</span> и{' '}
          <span style={{ color: '#3b82f6', fontWeight: 700 }}>◀ обратка</span> идут параллельно.
          Укажите длину одной трубы — обратная рассчитывается автоматически.
        </p>
      </div>

      <Field label="Длина трубы в одну сторону">
        <SInput type="number" value={length}
          onChange={e => onUpdateEdge({ length: parseFloat(e.target.value) || '' })}
          step={0.5} min={0.1} placeholder="1.0" />
      </Field>
      <Row label="Суммарная длина (×2)" value={length ? (parseFloat(length) * 2).toFixed(1) : '—'} unit="м" color={D.muted} />

      {res && (
        <>
          <div style={{ height: 1, background: D.border }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Результаты (на одну трубу)
          </p>
          <div className="space-y-1.5">
            <Row label="Диаметр"  value={res.size ? `Ø${res.size.outer}×${res.size.wall}` : '—'} unit="мм" />
            <Row label="Скорость" value={res.velocity?.toFixed(3)} unit="м/с"  color={D.warn} />
            <Row label="ΔP (подача+обратка)" value={res.pressureLoss?.toFixed(1)} unit="Па" color={D.warn} />
            <Row label="Расход"   value={res.flowRate?.toFixed(2)} unit="л/мин" />
          </div>
        </>
      )}
    </div>
  );
}

// Инспектор узла
function NodePanel({ node, res, onUpdate, onDelete, onRotate, deltaT }) {
  const [flowWarn, setFlowWarn] = useState(false);
  const color = NODE_COLORS[node.type] || D.accent;

  return (
    <div className="p-3 space-y-3" style={{ color: D.text }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: D.bright }}>{NODE_LABELS[node.type] || node.type}</span>
          </div>
          <p style={{ fontSize: 9, color: D.muted, marginTop: 2 }}>{node.id}</p>
        </div>
        <div className="flex gap-1">
          {node.type !== 'pump' && onRotate && (
            <button onClick={() => onRotate(node.id)} style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              background: D.card, border: `1px solid ${D.border}`, color: D.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RotateCw size={13} />
            </button>
          )}
          {node.type !== 'pump' && (
            <button onClick={onDelete} style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              background: D.card, border: `1px solid ${D.border}`, color: D.red,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: D.border }} />

      {node.type !== 'pump' && (
        <div style={{ fontSize: 10, color: D.muted, background: D.card, borderRadius: 5,
          padding: '3px 8px', border: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span>Поворот</span>
          <span style={{ color: D.accent, fontWeight: 700 }}>{node.rotation || 0}°</span>
        </div>
      )}

      {node.type === 'radiator' && (
        <>
          <Field label="Помещение">
            <SInput type="text" value={node.props?.roomName ?? ''}
              onChange={e => onUpdate({ roomName: e.target.value })} placeholder="Гостиная..." />
          </Field>
          <p style={{ fontSize: 9, color: D.muted, textAlign: 'center' }}>— Укажите расход или мощность —</p>
          {flowWarn && (
            <div className="flex items-center gap-1" style={{
              fontSize: 10, color: D.warn, background: '#292100',
              borderRadius: 5, padding: '3px 8px', border: `1px solid ${D.warn}33` }}>
              <AlertCircle size={12} /> Минимум: 0.65 л/мин
            </div>
          )}
          <Field label="Расход, л/мин">
            <SInput type="number" value={node.props?.flowRate ?? ''}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (v > 0 && v < 0.65) { onUpdate({ flowRate: 0.65, power: '' }); setFlowWarn(true); }
                else { onUpdate({ flowRate: e.target.value, power: '' }); setFlowWarn(false); }
              }} step={0.1} min={0} placeholder="0.65" />
          </Field>
          <Field label="Мощность, Вт">
            <SInput type="number" value={node.props?.power ?? ''}
              onChange={e => { onUpdate({ power: e.target.value, flowRate: '' }); setFlowWarn(false); }}
              step={100} min={0} placeholder="" />
            {deltaT != null && (
              <p style={{ fontSize: 9, color: D.muted, marginTop: 3, lineHeight: 1.4 }}>
                * Вводите мощность при Δt = <span style={{ color: '#34d399', fontWeight: 700 }}>{deltaT}°C</span>
              </p>
            )}
          </Field>
        </>
      )}

      {res && (
        <>
          <div style={{ height: 1, background: D.border }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Результаты
          </p>
          <div className="space-y-1.5">
            {node.type === 'pump' && <>
              <Row label="Расход Q"  value={res.flowRate?.toFixed(1)}       unit="л/мин" color={D.accent} />
              <Row label="Напор H"   value={res.head?.toFixed(2)}           unit="м вод.ст." />
              <Row label="ΔP"        value={(res.pressure/1000)?.toFixed(2)} unit="кПа"  color="#a78bfa" />
            </>}
            {node.type === 'tee' && <>
              <Row label="Диаметр"     value={res.size ? `Ø${res.size.outer}` : '—'} unit="мм" />
              <Row label="ΔP прямой"   value={res.pressureLossPass?.toFixed(1)}   unit="Па" />
              <Row label="ΔP ответвл." value={res.pressureLossBranch?.toFixed(1)} unit="Па" />
              <Row label="Расход"      value={res.flowRate?.toFixed(2)}            unit="л/мин" />
            </>}
            {node.type === 'elbow' && <>
              <Row label="Диаметр" value={res.size ? `Ø${res.size.outer}` : '—'} unit="мм" />
              <Row label="ΔP"      value={res.pressureLoss?.toFixed(1)} unit="Па" color={D.warn} />
              <Row label="Расход"  value={res.flowRate?.toFixed(2)} unit="л/мин" />
            </>}
            {node.type === 'radiator' && <>
              <Row label="Расход"              value={res.flowRate?.toFixed(3)}              unit="л/мин" />
              <Row label="Диаметр подвода"      value={res.size ? `Ø${res.size.outer}` : '—'} unit="мм" />
              <Row label="ΔP термоклапан"       value={(res.pressureLossValve / 1000)?.toFixed(1)} unit="кПа" color={D.red} />
              <Row label="ΔP арматура"          value={res.pressureLossDynamic?.toFixed(1)}   unit="Па"  color={D.warn} />
              <Row label="ΔP итого (радиатор)"  value={(res.pressureLoss / 1000)?.toFixed(2)} unit="кПа" color={D.green} />
            </>}
          </div>
        </>
      )}
    </div>
  );
}

export default function GraphInspector({ selected, nodes, edges, results, deltaT, onUpdateNode, onDeleteNode, onRotate, onUpdateEdge, onDeleteEdge }) {
  if (!selected) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center gap-3">
        <Info className="w-7 h-7" style={{ color: D.muted }} />
        <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.6 }}>
          Выберите элемент или трубу на схеме
        </p>
      </div>
    );
  }

  const edge = edges.find(e => e.id === selected);
  if (edge) {
    return <EdgePanel edge={edge} res={results?.[edge.id]}
      onUpdateEdge={props => onUpdateEdge(edge.id, props)}
      onDeleteEdge={() => onDeleteEdge(edge.id)} />;
  }

  const node = nodes.find(n => n.id === selected);
  if (!node) return null;
  return <NodePanel node={node} res={results?.[node.id]}
    onUpdate={props => onUpdateNode(node.id, props)}
    onDelete={() => onDeleteNode(node.id)}
    onRotate={onRotate}
    deltaT={deltaT} />;
}