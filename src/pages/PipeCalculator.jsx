/**
 * PipeCalculator — главная страница
 * Модель: nodes (компоненты) + edges (трубы-рёбра)
 * Труба создаётся при соединении двух портов через клик
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Play, BarChart2, Flame, RotateCcw, AlertCircle } from 'lucide-react';
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
  validateTopology, computeFlowDirections, getAutoCappedPorts,
} from '@/lib/hydraulicGraph';
import { calcHydraulicGraph } from '@/lib/hydraulicCalcEngine';
import { PIPE_TYPES } from '@/lib/pipeStandards';
import ResultsDialog from '@/components/pipe-calc/ResultsDialog';
import ResetConfirmDialog from '@/components/pipe-calc/ResetConfirmDialog';
import AboutDialog from '@/components/pipe-calc/AboutDialog';

const DEFAULT_PARAMS = { pipeType: 'ppr_pn20', tSupply: 75, tReturn: 60, tAir: 22 };

// Начальное состояние: один насос в центре
const PUMP_NODE = { id: 'pump-0', type: 'pump', x: 200, y: 300, rotation: 0, props: {} };

const STORAGE_KEY = 'hydro-graph-v1';

function loadSavedGraph() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default function PipeCalculator() {
  const canvasRef = useRef(null);
  const saved = loadSavedGraph();
  const [nodes,      setNodes]      = useState(saved?.nodes || [PUMP_NODE]);
  const [edges,      setEdges]      = useState(saved?.edges || []);
  const [selectedId, setSelectedId] = useState(null);

  // Режим соединения: первый выбранный порт
  const [pendingPort, setPendingPort] = useState(null);

  const [results,    setResults]    = useState(null);
  const [pumpSummary, setPumpSummary] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [validation, setValidation] = useState(null);
  const [cappedPorts, setCappedPorts] = useState(new Set()); // заглушённые порты "nodeId:portId"

  const [globalParams, setGlobalParams] = useState(
    saved?.globalParams || DEFAULT_PARAMS
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Автосохранение при каждом изменении графа
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, globalParams }));
  }, [nodes, edges, globalParams]);
  const deltaT = +((globalParams.tSupply + globalParams.tReturn) / 2 - globalParams.tAir).toFixed(1);

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

  // ─── Клик по порту: режим соединения или заглушка ───────────────────────────
  const handlePortClick = useCallback((nodeId, portId) => {
    const key = `${nodeId}:${portId}`;
    const occupiedPorts = new Set(edges.flatMap(e => [
      `${e.fromNodeId}:${e.fromPortId}`, `${e.toNodeId}:${e.toPortId}`,
    ]));

    if (!pendingPort) {
      if (!occupiedPorts.has(key)) {
        // Клик по заглушённому → снять заглушку
        if (cappedPorts.has(key)) {
          setCappedPorts(prev => { const next = new Set(prev); next.delete(key); return next; });
          setValidation(null);
          return;
        }
        // Начало соединения
        setPendingPort({ nodeId, portId });
        setSelectedId(nodeId);
        toast.info('Выберите второй порт. Кликните по тому же порту ещё раз — чтобы заглушить его.');
      }
      return;
    }

    // Второй клик на тот же порт → заглушить
    if (pendingPort.nodeId === nodeId && pendingPort.portId === portId) {
      setPendingPort(null);
      setCappedPorts(prev => { const next = new Set(prev); next.add(key); return next; });
      setValidation(null);
      toast.success('Порт заглушён. Кликните по крестику снова, чтобы снять заглушку.');
      return;
    }

    // Не соединять порты одного и того же элемента
    if (pendingPort.nodeId === nodeId) {
      toast.error('Нельзя соединять порты одного элемента');
      setPendingPort(null);
      return;
    }

    // Не соединять уже занятые порты повторно
    if (occupiedPorts.has(`${pendingPort.nodeId}:${pendingPort.portId}`) ||
        occupiedPorts.has(`${nodeId}:${portId}`)) {
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
  const handleResetConfirm = useCallback(() => {
    resetUid();
    setNodes([{ ...PUMP_NODE }]);
    setEdges([]);
    setSelectedId(null);
    setPendingPort(null);
    setResults(null);
    setValidation(null);
    setCappedPorts(new Set());
    setGlobalParams(DEFAULT_PARAMS);
    setShowResetConfirm(false);
  }, []);

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  // ─── Расчёт ─────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    try {
      console.log('[Calc] nodes:', nodes.length, 'edges:', edges.length);
      const val = validateTopology(nodes, edges, effectiveCappedPorts);
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
      setPumpSummary({ pumpHead: res.pumpHead, pumpFlow: res.pumpFlow, systemDp: res.systemDp, systemDpOk: res.systemDpOk });
      // Показываем предупреждения автокоррекции
      (res.warnings || []).forEach(w => toast.warning(w, { duration: 6000 }));
      toast.success(`Насос: H=${res.pumpHead.toFixed(2)} м,  Q=${res.pumpFlow.toFixed(1)} л/мин  |  ΔP=${(res.systemDp/1000).toFixed(1)} кПа`);
    } catch (err) {
      console.error('[Calc] exception:', err);
      toast.error(`Ошибка расчёта: ${err.message}`);
    }
  }, [nodes, edges, globalParams]);

  const openPorts   = validation ? validation.openPorts : [];
  const hasErrors   = validation && !validation.valid;
  const { inPorts } = computeFlowDirections(nodes, edges);
  // Объединяем ручные заглушки + автозаглушки подключённых радиаторов
  const effectiveCappedPorts = getAutoCappedPorts(nodes, edges, cappedPorts);

  return (
    <div className="h-screen flex flex-col" style={{ overflow: 'hidden', background: '#0f172a' }}>

      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 shrink-0"
        style={{ background: '#0f172a', borderBottom: '1px solid #1e3a5f' }}>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col gap-0.5">
            <img src="https://media.base44.com/images/public/6a2273e3e4eb03727e3a6619/7c2fd97dc_logoTroinik.svg" alt="Troinik" className="h-6 object-contain" />
            <div className="text-[10px]" style={{ color: '#ffffff' }}>Топологическая гидравлическая модель</div>
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

          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Воздух °C:</Label>
          <Input type="number" value={globalParams.tAir}
            onChange={e => setGlobalParams(p => ({ ...p, tAir: +e.target.value }))}
            className="h-7 w-14 text-xs"
            style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }} />

          <div className="flex items-center gap-1 px-2 h-7 rounded text-xs font-bold"
            style={{ background: '#1e293b', border: '1px solid #1e3a5f', color: '#34d399' }}>
            Δt = {deltaT}°C
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}
            className="gap-1 text-xs h-8" style={{ color: '#64748b' }}>
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить
          </Button>
          {results && (
            <>
              {pumpSummary?.systemDp != null && (
                <div className="flex items-center gap-1 px-2 h-7 rounded text-xs font-bold"
                  style={{
                    background: '#1e293b',
                    border: `1px solid ${pumpSummary.systemDpOk ? '#14532d' : '#7f1d1d'}`,
                    color: pumpSummary.systemDpOk ? '#34d399' : '#f87171',
                  }}>
                  ΔP = {(pumpSummary.systemDp / 1000).toFixed(1)} кПа
                  {pumpSummary.systemDpOk ? ' ✓' : ' ⚠'}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowResults(true)}
                className="gap-1.5 text-xs h-8"
                style={{ borderColor: '#1e3a5f', color: '#34d399', background: '#0a1929' }}>
                <BarChart2 className="w-3.5 h-3.5" /> Результат расчёта
              </Button>
            </>
          )}
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

      <ResetConfirmDialog
        open={showResetConfirm}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
      />

      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />

      <ResultsDialog
        open={showResults}
        onClose={() => setShowResults(false)}
        results={results}
        pumpHead={pumpSummary?.pumpHead}
        pumpFlow={pumpSummary?.pumpFlow}
        nodes={nodes}
        edges={edges}
        globalParams={globalParams}
        canvasRef={canvasRef}
      />

      {/* Кнопка О нас */}
      <button
        onClick={() => setShowAbout(true)}
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 50,
          background: '#1e293b', border: '1px solid #1e3a5f',
          color: '#475569', borderRadius: 6, padding: '5px 12px',
          fontSize: 11, cursor: 'pointer',
        }}
      >
        О нас
      </button>

      <div className="flex flex-1 overflow-hidden">
        <ElementPanel onAddElement={handleAddElement} />

        <div className="flex-1 relative overflow-hidden"
          onKeyDown={e => { if (e.key === 'Escape') setPendingPort(null); }}
          tabIndex={0}>
          <GraphCanvas
            ref={canvasRef}
            onDropElement={(type, x, y) => {
              const n = createNode(type, x, y);
              setNodes(prev => [...prev, n]);
              setSelectedId(n.id);
              setResults(null);
              setValidation(null);
              return n.id;
            }}
            nodes={nodes}
            edges={edges}
            selectedId={pendingPort ? pendingPort.nodeId : selectedId}
            results={results}
            openPorts={openPorts}
            cappedPorts={effectiveCappedPorts}
            inPorts={inPorts}
            onNodeMove={handleNodeMove}
            onNodeClick={id => { setPendingPort(null); setSelectedId(id); }}
            onPortClick={handlePortClick}
            onRotate={handleRotate}
            onDelete={handleDelete}
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
            deltaT={deltaT}
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