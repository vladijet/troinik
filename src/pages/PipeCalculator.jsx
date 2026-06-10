/**
 * PipeCalculator — главная страница
 * Модель: nodes (компоненты) + edges (трубы-рёбра)
 * Труба создаётся при соединении двух портов через клик
 */
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Play, Download, Flame, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import GraphCanvas    from '@/components/pipe-calc/GraphCanvas';
import GraphInspector from '@/components/pipe-calc/GraphInspector';
import ElementPanel   from '@/components/pipe-calc/ElementPanel';

import {
  createNode, createEdge, resetUid,
  NODE_PORT_CONFIG, NODE_SIZE, getPortAbsPos,
  validateTopology,
} from '@/lib/hydraulicGraph';
import { calcHydraulicGraph } from '@/lib/hydraulicCalcEngine';
import { PIPE_TYPES } from '@/lib/pipeStandards';

// Начальное состояние: один насос в центре
const PUMP_NODE = { id: 'pump-0', type: 'pump', x: 200, y: 300, rotation: 0, props: {} };

export default function PipeCalculator() {
  const [nodes,      setNodes]      = useState([PUMP_NODE]);
  const [edges,      setEdges]      = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Режим соединения: первый выбранный порт
  const [pendingPort, setPendingPort] = useState(null);

  const [results,    setResults]    = useState(null);
  const [validation, setValidation] = useState(null); // { valid, errors, openPorts }

  const [globalParams, setGlobalParams] = useState({
    pipeType: 'ppr_pn20', tSupply: 80, tReturn: 60,
  });

  // Del → удалить выбранный
  useEffect(() => {
    const h = (e) => {
      if (!['Delete','Backspace'].includes(e.key)) return;
      if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if (selectedId) handleDelete(selectedId);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedId, edges]);

  // ─── Добавить узел в свободную позицию ───────────────────────────────────
  const handleAddElement = useCallback((type) => {
    // Размещаем правее насоса, смещение по количеству уже добавленных
    const base = nodes.length * 60 + 320;
    const n = createNode(type, base, 300);
    setNodes(prev => [...prev, n]);
    setSelectedId(n.id);
    setResults(null);
    setValidation(null);
  }, [nodes]);

  // ─── Перемещение узла ────────────────────────────────────────────────────
  const handleNodeMove = useCallback((id, x, y) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  // ─── Клик по порту: режим соединения ────────────────────────────────────
  // Первый клик — запоминаем порт-источник.
  // Второй клик — создаём ребро (трубу) между ними.
  const handlePortClick = useCallback((nodeId, portId) => {
    if (!pendingPort) {
      // Начало соединения
      setPendingPort({ nodeId, portId });
      setSelectedId(nodeId);
      toast.info('Выберите второй порт для соединения');
      return;
    }

    // Не соединять порты одного и того же элемента
    if (pendingPort.nodeId === nodeId) {
      toast.error('Нельзя соединять порты одного элемента');
      setPendingPort(null);
      return;
    }

    // Не соединять уже занятые порты повторно
    const usedPorts = new Set(edges.flatMap(e => [
      `${e.fromNodeId}:${e.fromPortId}`, `${e.toNodeId}:${e.toPortId}`,
    ]));
    if (usedPorts.has(`${pendingPort.nodeId}:${pendingPort.portId}`) ||
        usedPorts.has(`${nodeId}:${portId}`)) {
      toast.error('Один из портов уже занят');
      setPendingPort(null);
      return;
    }

    // Определяем направление: from = out-порт, to = in-порт
    const fromConfig = NODE_PORT_CONFIG[nodes.find(n => n.id === pendingPort.nodeId)?.type];
    const fromPortType = fromConfig?.[pendingPort.portId]?.type;

    let fromNodeId = pendingPort.nodeId, fromPortId = pendingPort.portId;
    let toNodeId   = nodeId,            toPortId   = portId;

    if (fromPortType === 'in') {
      // Поменяем местами
      [fromNodeId, fromPortId, toNodeId, toPortId] = [toNodeId, toPortId, fromNodeId, fromPortId];
    }

    const newEdge = createEdge(fromNodeId, fromPortId, toNodeId, toPortId);
    setEdges(prev => [...prev, newEdge]);
    setPendingPort(null);
    setSelectedId(newEdge.id);
    setResults(null);
    setValidation(null);
    toast.success('Труба соединена. Укажите длину в инспекторе.');
  }, [pendingPort, edges, nodes]);

  // ─── Обновить свойства узла ──────────────────────────────────────────────
  const handleUpdateNode = useCallback((id, props) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, props: { ...n.props, ...props } } : n));
    setResults(null);
  }, []);

  // ─── Обновить свойства ребра (трубы) ────────────────────────────────────
  const handleUpdateEdge = useCallback((id, pipeProps) => {
    setEdges(prev => prev.map(e => e.id === id ? { ...e, pipeProps: { ...e.pipeProps, ...pipeProps } } : e));
    setResults(null);
  }, []);

  // ─── Удалить выбранный элемент ───────────────────────────────────────────
  const handleDelete = useCallback((id) => {
    if (!id || id === 'pump-0') return;
    // Ребро?
    if (edges.find(e => e.id === id)) {
      setEdges(prev => prev.filter(e => e.id !== id));
    } else {
      // Узел: удаляем и все связанные рёбра
      setEdges(prev => prev.filter(e => e.fromNodeId !== id && e.toNodeId !== id));
      setNodes(prev => prev.filter(n => n.id !== id));
    }
    setSelectedId(null);
    setResults(null);
    setValidation(null);
  }, [edges]);

  // ─── Поворот ────────────────────────────────────────────────────────────
  const handleRotate = useCallback((id) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, rotation: ((n.rotation || 0) + 90) % 360 } : n));
    setResults(null);
  }, []);

  // ─── Сброс ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!confirm('Очистить всю схему?')) return;
    resetUid();
    setNodes([{ ...PUMP_NODE }]);
    setEdges([]);
    setSelectedId(null);
    setPendingPort(null);
    setResults(null);
    setValidation(null);
  }, []);

  // ─── Расчёт ─────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    try {
      console.log('[Calc] nodes:', nodes.length, 'edges:', edges.length);
      const val = validateTopology(nodes, edges);
      console.log('[Calc] validation:', val);
      setValidation(val);
      if (!val.valid) {
        toast.error(val.errors[0] || 'Схема не замкнута');
        return;
      }
      const res = calcHydraulicGraph(nodes, edges, globalParams);
      console.log('[Calc] result:', res);
      if (res.error) { toast.error(res.error); return; }
      setResults(res.elementResults);
      toast.success(`Насос: H=${res.pumpHead.toFixed(2)} м,  Q=${res.pumpFlow.toFixed(1)} л/мин`);
    } catch (err) {
      console.error('[Calc] exception:', err);
      toast.error(`Ошибка расчёта: ${err.message}`);
    }
  }, [nodes, edges, globalParams]);

  const openPorts   = validation ? validation.openPorts : [];
  const hasErrors   = validation && !validation.valid;

  return (
    <div className="h-screen flex flex-col" style={{ overflow: 'hidden', background: '#0f172a' }}>

      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 shrink-0"
        style={{ background: '#0f172a', borderBottom: '1px solid #1e3a5f' }}>

        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg" style={{ background: '#1e3a5f' }}>
            <Flame className="w-4 h-4" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div className="text-sm font-bold leading-none" style={{ color: '#e2e8f0' }}>HydroCalc</div>
            <div className="text-[10px]" style={{ color: '#334155' }}>Топологическая гидравлическая модель</div>
          </div>
        </div>

        <div className="h-6 w-px mx-1" style={{ background: '#1e3a5f' }} />

        <div className="flex items-center gap-2 text-xs">
          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Трубы:</Label>
          <Select value={globalParams.pipeType}
            onValueChange={v => { setGlobalParams(p => ({ ...p, pipeType: v })); setResults(null); }}>
            <SelectTrigger className="h-7 text-xs w-52"
              style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PIPE_TYPES).map(([k, s]) => (
                <SelectItem key={k} value={k} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Подача °C:</Label>
          <Input type="number" value={globalParams.tSupply}
            onChange={e => setGlobalParams(p => ({ ...p, tSupply: +e.target.value }))}
            className="h-7 w-14 text-xs"
            style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }} />

          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Обратка °C:</Label>
          <Input type="number" value={globalParams.tReturn}
            onChange={e => setGlobalParams(p => ({ ...p, tReturn: +e.target.value }))}
            className="h-7 w-14 text-xs"
            style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}
            className="gap-1 text-xs h-8" style={{ color: '#64748b' }}>
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить
          </Button>
          <Button onClick={handleCalculate} size="sm" className="gap-1.5 text-xs h-8">
            <Play className="w-3.5 h-3.5" /> Рассчитать
          </Button>
        </div>
      </header>

      {/* Ошибки валидации */}
      {hasErrors && (
        <div className="px-4 py-1.5 flex items-center gap-2 shrink-0"
          style={{ background: '#1a0a0a', borderBottom: '1px solid #7f1d1d' }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#f87171' }} />
          <span className="text-xs" style={{ color: '#fca5a5' }}>
            {validation.errors.join('  ·  ')}
          </span>
        </div>
      )}

      {/* Подсказка режима соединения */}
      {pendingPort && (
        <div className="px-4 py-1.5 flex items-center gap-2 shrink-0"
          style={{ background: '#0c1a0a', borderBottom: '1px solid #14532d' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#4ade80' }} />
          <span className="text-xs" style={{ color: '#86efac' }}>
            Выберите второй порт для подключения трубы.
            Нажмите <kbd className="px-1 rounded text-[10px]" style={{ background: '#14532d', color: '#4ade80' }}>Esc</kbd> для отмены.
          </span>
        </div>
      )}

      {/* Подсказка (начальное состояние) */}
      {!pendingPort && !hasErrors && !results && (
        <div className="px-4 py-1.5 flex items-center gap-2 shrink-0"
          style={{ background: '#0f1929', borderBottom: '1px solid #1e3a5f' }}>
          <span className="text-[11px]" style={{ color: '#334155' }}>
            Нажмите на <span style={{ color: '#4ade80' }}>зелёную точку</span> порта, затем на порт другого элемента — появится труба.
            Все порты должны быть закрыты. Каждая ветка заканчивается радиатором.
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ElementPanel onAddElement={handleAddElement} />

        <div className="flex-1 relative overflow-hidden"
          onKeyDown={e => { if (e.key === 'Escape') setPendingPort(null); }}
          tabIndex={0}>
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            selectedId={pendingPort ? pendingPort.nodeId : selectedId}
            results={results}
            openPorts={openPorts}
            onNodeMove={handleNodeMove}
            onNodeClick={id => { setPendingPort(null); setSelectedId(id); }}
            onPortClick={handlePortClick}
            onRotate={handleRotate}
            onEdgeClick={id => { setPendingPort(null); setSelectedId(id); }}
          />
        </div>

        <div className="w-64 overflow-y-auto shrink-0"
          style={{ background: '#0f172a', borderLeft: '1px solid #1e3a5f' }}>
          <GraphInspector
            selected={selectedId}
            nodes={nodes}
            edges={edges}
            results={results}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDelete}
            onRotate={handleRotate}
            onUpdateEdge={handleUpdateEdge}
            onDeleteEdge={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}