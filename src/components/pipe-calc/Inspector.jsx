import { Trash2, Info, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ELEMENT_TYPES } from './elementConfig';

function ResultRow({ label, value, unit, color = 'text-emerald-700' }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value} {unit}</span>
    </div>
  );
}

export default function Inspector({ element, results, onUpdate, onDelete }) {
  const [flowWarning, setFlowWarning] = useState(false);

  if (!element) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center gap-2">
        <Info className="w-8 h-8 text-slate-300" />
        <p className="text-xs text-slate-400">Выберите элемент на схеме для редактирования его параметров</p>
      </div>
    );
  }

  const config = ELEMENT_TYPES[element.type];

  return (
    <div className="p-3 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm">{config?.label}</h3>
          <p className="text-[10px] text-slate-400">{element.id}</p>
        </div>
        {element.type !== 'pump' && (
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-400 hover:text-red-600 h-7 w-7">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Properties */}
      {element.type === 'pipe' && (
        <div className="space-y-2">
          <Label className="text-xs">Длина участка, м</Label>
          <Input
            type="number"
            value={element.props?.length ?? ''}
            onChange={e => onUpdate({ length: parseFloat(e.target.value) || '' })}
            step={0.5} min={0.1}
            className="h-8 text-sm"
          />
        </div>
      )}

      {element.type === 'radiator' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Название помещения</Label>
            <Input
              value={element.props?.roomName ?? ''}
              onChange={e => onUpdate({ roomName: e.target.value })}
              placeholder="Гостиная..."
              className="h-8 text-sm"
            />
          </div>
          <div className="pt-1 pb-0.5">
            <p className="text-[10px] text-slate-400 text-center">— укажите расход ИЛИ мощность —</p>
          </div>
          {flowWarning && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              Минимальный расход ограничен 0.65 л/мин
            </div>
          )}
          <div>
            <Label className="text-xs">Расход теплоносителя, л/мин</Label>
            <Input
              type="number"
              value={element.props?.flowRate ?? ''}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (val > 0 && val < 0.65) {
                  onUpdate({ flowRate: 0.65, power: '' });
                  setFlowWarning(true);
                } else {
                  onUpdate({ flowRate: e.target.value, power: '' });
                  setFlowWarning(false);
                }
              }}
              step={0.1} min={0}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Мощность радиатора при ΔT=70°, Вт</Label>
            <Input
              type="number"
              value={element.props?.power ?? ''}
              onChange={e => { onUpdate({ power: e.target.value, flowRate: '' }); setFlowWarning(false); }}
              step={100} min={0}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="pt-1 border-t border-slate-100 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Результаты расчёта</p>

          {element.type === 'pump' && (
            <>
              <ResultRow label="Расход" value={results.flowRate?.toFixed(1)} unit="л/мин" />
              <ResultRow label="Напор насоса" value={results.head?.toFixed(2)} unit="м вод.ст." />
              <ResultRow label="Перепад давления" value={(results.pressure / 1000)?.toFixed(2)} unit="кПа" />
            </>
          )}

          {element.type === 'pipe' && (
            <>
              <ResultRow label="Диаметр" value={results.size ? `Ø${results.size.outer}×${results.size.wall}` : '—'} unit="мм" />
              <ResultRow label="Скорость" value={results.velocity?.toFixed(3)} unit="м/с" />
              <ResultRow label="Потери давления" value={results.pressureLoss?.toFixed(1)} unit="Па" />
              <ResultRow label="Расход" value={results.flowRate?.toFixed(2)} unit="л/мин" />
            </>
          )}

          {element.type === 'tee' && (
            <>
              <ResultRow label="Диаметр" value={results.size ? `Ø${results.size.outer}` : '—'} unit="мм" />
              <ResultRow label="ΔP прямой" value={results.pressureLossPass?.toFixed(1)} unit="Па" />
              <ResultRow label="ΔP ответвл." value={results.pressureLossBranch?.toFixed(1)} unit="Па" />
            </>
          )}

          {element.type === 'elbow' && (
            <>
              <ResultRow label="Диаметр" value={results.size ? `Ø${results.size.outer}` : '—'} unit="мм" />
              <ResultRow label="Потери давления" value={results.pressureLoss?.toFixed(1)} unit="Па" />
            </>
          )}

          {element.type === 'radiator' && (
            <ResultRow label="Расход" value={results.flowRate?.toFixed(3)} unit="л/мин" />
          )}
        </div>
      )}
    </div>
  );
}