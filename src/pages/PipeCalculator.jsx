import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Play, Download, Flame, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Canvas from '@/components/pipe-calc/Canvas';
import ElementPanel from '@/components/pipe-calc/ElementPanel';
import Inspector from '@/components/pipe-calc/Inspector';
import { ELEMENT_TYPES, getOpenOutPorts } from '@/components/pipe-calc/elementConfig';
import { calcSystem } from '@/lib/pipeCalcEngine';
import { PIPE_TYPES } from '@/lib/pipeStandards';
import jsPDF from 'jspdf';

let _id = 1;
const uid = () => `el-${_id++}`;
const cid = () => `c-${_id++}`;

const INIT_PUMP = { id: 'pump-0', type: 'pump', x: 160, y: 260, props: {} };

export default function PipeCalculator() {
  const [elements, setElements] = useState([INIT_PUMP]);
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activePort, setActivePort] = useState({ elementId: 'pump-0', portId: 'out' });
  const [results, setResults] = useState(null);
  const [globalParams, setGlobalParams] = useState({ pipeType: 'ppr_pn20', tSupply: 80, tReturn: 60 });

  const selectedElement = elements.find(e => e.id === selectedId) || null;

  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedId !== 'pump-0') {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  const handleAddElement = useCallback((type) => {
    if (!activePort) { toast.error('Нет доступной точки подключения. Нажмите на красную точку на схеме.'); return; }

    const activeEl = elements.find(e => e.id === activePort.elementId);
    if (!activeEl) return;

    const activeCfg = ELEMENT_TYPES[activeEl.type];
    const activePortCfg = activeCfg.ports[activePort.portId];
    const apx = activeEl.x + activePortCfg.x;
    const apy = activeEl.y + activePortCfg.y;

    const newCfg = ELEMENT_TYPES[type];
    const inEntry = Object.entries(newCfg.ports).find(([, p]) => p.type === 'in');
    const GAP = 30;
    let nx, ny;

    if (inEntry) {
      const [, inp] = inEntry;
      const dx = activePortCfg.x, dy = activePortCfg.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        nx = apx + (dx > 0 ? GAP : -GAP) - inp.x;
        ny = apy - inp.y;
      } else {
        nx = apx - inp.x;
        ny = apy + (dy > 0 ? GAP : -GAP) - inp.y;
      }
    } else {
      nx = apx + 140; ny = apy;
    }

    const newEl = { id: uid(), type, x: nx, y: ny, props: { ...newCfg.defaultProps } };
    const newConn = inEntry ? {
      id: cid(),
      fromElementId: activePort.elementId,
      fromPortId: activePort.portId,
      toElementId: newEl.id,
      toPortId: inEntry[0],
    } : null;

    const outPorts = Object.entries(newCfg.ports).filter(([, p]) => p.type === 'out');
    let newActive = null;
    if (outPorts.length > 0) {
      newActive = { elementId: newEl.id, portId: outPorts[0][0] };
    } else {
      const updatedEls = [...elements, newEl];
      const updatedConns = newConn ? [...connections, newConn] : connections;
      const open = getOpenOutPorts(updatedEls, updatedConns);
      newActive = open.length > 0 ? { elementId: open[0].elementId, portId: open[0].portId } : null;
    }

    setElements(prev => [...prev, newEl]);
    if (newConn) setConnections(prev => [...prev, newConn]);
    setActivePort(newActive);
    setSelectedId(newEl.id);
    setResults(null);
  }, [elements, connections, activePort]);

  const handleElementMove = useCallback((elId, x, y) => {
    setElements(prev => prev.map(e => e.id === elId ? { ...e, x, y } : e));
  }, []);

  const handlePortClick = useCallback((elementId, portId) => {
    setActivePort({ elementId, portId });
    setSelectedId(elementId);
  }, []);

  const handleUpdateProps = useCallback((props) => {
    if (!selectedId) return;
    setElements(prev => prev.map(e => e.id === selectedId ? { ...e, props: { ...e.props, ...props } } : e));
    setResults(null);
  }, [selectedId]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId || selectedId === 'pump-0') return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setConnections(prev => prev.filter(c => c.fromElementId !== selectedId && c.toElementId !== selectedId));
    if (activePort?.elementId === selectedId) setActivePort({ elementId: 'pump-0', portId: 'out' });
    setSelectedId(null);
    setResults(null);
  }, [selectedId, activePort]);

  const handleReset = useCallback(() => {
    if (!confirm('Очистить всю схему?')) return;
    _id = 1;
    setElements([{ ...INIT_PUMP }]);
    setConnections([]);
    setSelectedId(null);
    setActivePort({ elementId: 'pump-0', portId: 'out' });
    setResults(null);
  }, []);

  const handleCalculate = useCallback(() => {
    const radiators = elements.filter(e => e.type === 'radiator');
    if (radiators.length === 0) { toast.error('Добавьте хотя бы один радиатор'); return; }

    const noData = radiators.find(r => !r.props?.flowRate && !r.props?.power);
    if (noData) { toast.error('Укажите расход или мощность для всех радиаторов'); setSelectedId(noData.id); return; }

    const pipes = elements.filter(e => e.type === 'pipe');
    const noLen = pipes.find(p => !p.props?.length || +p.props.length <= 0);
    if (noLen) { toast.error('Укажите длину для всех труб'); setSelectedId(noLen.id); return; }

    const res = calcSystem(elements, connections, globalParams);
    if (res.error) { toast.error(res.error); return; }

    setResults(res.elementResults);
    toast.success(`Расчёт выполнен. Напор насоса: ${res.pumpHead.toFixed(2)} м, Q: ${res.pumpFlow.toFixed(1)} л/мин`);
  }, [elements, connections, globalParams]);

  const handleExportPDF = useCallback(() => {
    if (!results) { toast.error('Сначала выполните расчёт'); return; }

    const doc = new jsPDF('l', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth();
    const pSpec = PIPE_TYPES[globalParams.pipeType];

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Гидравлический расчёт системы отопления', W / 2, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Тип труб: ${pSpec?.name}   |   Подача: ${globalParams.tSupply}°C   |   Обратка: ${globalParams.tReturn}°C`, W / 2, 21, { align: 'center' });

    const pump = results['pump-0'];
    if (pump) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Насос:  Q = ${pump.flowRate?.toFixed(1)} л/мин   H = ${pump.head?.toFixed(2)} м   ΔP = ${(pump.pressure / 1000)?.toFixed(2)} кПа`, 14, 30);
      doc.setFont(undefined, 'normal');
    }

    const headers = ['Элемент', 'Помещение', 'Расход л/мин', 'Диаметр мм', 'Скорость м/с', 'ΔP, Па'];
    const colW = [55, 45, 28, 32, 30, 26];
    const startX = 14;
    let y = 40;

    doc.setFontSize(8);
    doc.setFillColor(219, 234, 254);
    doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 7, 'F');
    headers.forEach((h, i) => {
      doc.setFont(undefined, 'bold');
      doc.text(h, startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + 1, y);
    });
    y += 8;
    doc.setFont(undefined, 'normal');

    elements.forEach((el, idx) => {
      const res = results[el.id];
      if (!res) return;
      const row = ['', '', '-', '-', '-', '-'];
      if (el.type === 'pump') {
        row[0] = 'Насос'; row[2] = res.flowRate?.toFixed(1); row[5] = (res.pressure / 1000)?.toFixed(2) + ' кПа';
      } else if (el.type === 'pipe') {
        row[0] = `Труба L=${el.props?.length}м`; row[2] = res.flowRate?.toFixed(2);
        row[3] = res.size ? `Ø${res.size.outer}×${res.size.wall}` : '-';
        row[4] = res.velocity?.toFixed(3); row[5] = res.pressureLoss?.toFixed(0);
      } else if (el.type === 'tee') {
        row[0] = 'Тройник'; row[3] = res.size ? `Ø${res.size.outer}` : '-';
        row[5] = (res.pressureLossPass?.toFixed(0) || '-') + '/' + (res.pressureLossBranch?.toFixed(0) || '-');
      } else if (el.type === 'elbow') {
        row[0] = 'Угол 90°'; row[3] = res.size ? `Ø${res.size.outer}` : '-'; row[5] = res.pressureLoss?.toFixed(0);
      } else if (el.type === 'radiator') {
        row[0] = 'Радиатор'; row[1] = el.props?.roomName || ''; row[2] = res.flowRate?.toFixed(3);
      }

      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 7, 'F'); }
      row.forEach((cell, i) => {
        doc.text(String(cell || '-'), startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + 1, y);
      });
      y += 7;
      if (y > 190) { doc.addPage(); y = 20; }
    });

    doc.save('hydraulic-calc.pdf');
  }, [results, elements, globalParams]);

  return (
    <div className="h-screen flex flex-col bg-slate-50" style={{ overflow: 'hidden' }}>
      <header className="h-14 flex items-center gap-3 px-4 bg-white border-b border-slate-200 shrink-0 z-10">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none">HydroCalc</div>
            <div className="text-[10px] text-muted-foreground">Двухтрубная тройниковая система</div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-2 text-xs">
          <Label className="text-xs text-slate-500 shrink-0">Тип труб:</Label>
          <Select value={globalParams.pipeType} onValueChange={v => { setGlobalParams(p => ({ ...p, pipeType: v })); setResults(null); }}>
            <SelectTrigger className="h-7 text-xs w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PIPE_TYPES).map(([key, s]) => (
                <SelectItem key={key} value={key} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs text-slate-500 shrink-0">Подача °C:</Label>
          <Input type="number" value={globalParams.tSupply} onChange={e => setGlobalParams(p => ({ ...p, tSupply: +e.target.value }))} className="h-7 w-14 text-xs" />
          <Label className="text-xs text-slate-500 shrink-0">Обратка °C:</Label>
          <Input type="number" value={globalParams.tReturn} onChange={e => setGlobalParams(p => ({ ...p, tReturn: +e.target.value }))} className="h-7 w-14 text-xs" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-xs h-8">
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить
          </Button>
          <Button onClick={handleCalculate} size="sm" className="gap-1.5 text-xs h-8">
            <Play className="w-3.5 h-3.5" /> Выполнить расчёт
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1.5 text-xs h-8" disabled={!results}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </header>

      {!results && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 text-[11px] text-blue-600 flex items-center gap-2 shrink-0">
          <HelpCircle className="w-3 h-3 shrink-0" />
          Кликайте на элементы в левой панели — они добавляются к активной <span className="font-semibold text-red-500">красной точке</span>. Нажмите на любую точку, чтобы сделать её активной. Перетаскивайте элементы. Delete — удалить выбранный.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ElementPanel onAddElement={handleAddElement} />
        <div className="flex-1 relative overflow-hidden">
          <Canvas
            elements={elements}
            connections={connections}
            activePort={activePort}
            selectedId={selectedId}
            results={results}
            onElementMove={handleElementMove}
            onElementClick={setSelectedId}
            onPortClick={handlePortClick}
          />
        </div>
        <div className="w-60 bg-white border-l border-slate-200 overflow-y-auto shrink-0">
          <Inspector
            element={selectedElement}
            results={selectedElement ? results?.[selectedElement.id] : null}
            onUpdate={handleUpdateProps}
            onDelete={handleDeleteSelected}
          />
        </div>
      </div>
    </div>
  );
}