import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Play, Download, Flame, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import GraphCanvas   from '@/components/pipe-calc/GraphCanvas';
import GraphInspector from '@/components/pipe-calc/GraphInspector';
import ElementPanel  from '@/components/pipe-calc/ElementPanel';

import {
  createNode, createEdge, resetUid, uid,
  NODE_PORT_CONFIG, NODE_SIZE, getPortAbsPos, getOpenOutPorts,
} from '@/lib/hydraulicGraph';
import { calcHydraulicGraph } from '@/lib/hydraulicCalcEngine';
import { PIPE_TYPES } from '@/lib/pipeStandards';
import jsPDF from 'jspdf';

// ─── Initial state ────────────────────────────────────────────────────────────
const INIT_PUMP = { id: 'pump-0', type: 'pump', x: 160, y: 260, rotation: 0, props: {} };

export default function PipeCalculator() {
  const [nodes,      setNodes]      = useState([INIT_PUMP]);
  const [edges,      setEdges]      = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activePort, setActivePort] = useState({ nodeId: 'pump-0', portId: 'out' });
  const [results,    setResults]    = useState(null);
  const [globalParams, setGlobalParams] = useState({ pipeType: 'ppr_pn20', tSupply: 80, tReturn: 60 });

  const selectedNode = nodes.find(n => n.id === selectedId) || null;

  // Delete key handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedId !== 'pump-0') {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        handleDelete();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  // ─── Add element ────────────────────────────────────────────────────────────
  const handleAddElement = useCallback((type) => {
    if (!activePort) {
      toast.error('Нет активной точки подключения. Нажмите на зелёную точку порта.');
      return;
    }

    const activeNode = nodes.find(n => n.id === activePort.nodeId);
    if (!activeNode) return;

    const activePorts = NODE_PORT_CONFIG[activeNode.type];
    const activePortCfg = activePorts?.[activePort.portId];
    if (!activePortCfg) return;

    const ap = getPortAbsPos(activeNode, activePort.portId);
    if (!ap) return;

    // Position new node so its 'in' port aligns with active port
    const newPortConfig = NODE_PORT_CONFIG[type];
    const inEntry = Object.entries(newPortConfig).find(([, p]) => p.type === 'in');
    const GAP = 30;
    let nx, ny;

    if (inEntry) {
      const [, inp] = inEntry;
      const dx = ap.dir === 'right' ? GAP : ap.dir === 'left' ? -GAP : 0;
      const dy = ap.dir === 'down'  ? GAP : ap.dir === 'up'   ? -GAP : 0;
      nx = ap.x + dx - inp.x;
      ny = ap.y + dy - inp.y;
    } else {
      nx = ap.x + 140;
      ny = ap.y;
    }

    const newNode = createNode(type, nx, ny);
    const newEdge = inEntry
      ? createEdge(activePort.nodeId, activePort.portId, newNode.id, inEntry[0])
      : null;

    // Find next active port: first open 'out' port of new node
    const newNodeOutPorts = Object.entries(newPortConfig).filter(([, p]) => p.type === 'out');
    let nextActive = null;
    if (newNodeOutPorts.length > 0) {
      nextActive = { nodeId: newNode.id, portId: newNodeOutPorts[0][0] };
    } else {
      const updatedNodes = [...nodes, newNode];
      const updatedEdges = newEdge ? [...edges, newEdge] : edges;
      const open = getOpenOutPorts(updatedNodes, updatedEdges);
      nextActive = open.length > 0 ? { nodeId: open[0].nodeId, portId: open[0].portId } : null;
    }

    setNodes(prev => [...prev, newNode]);
    if (newEdge) setEdges(prev => [...prev, newEdge]);
    setActivePort(nextActive);
    setSelectedId(newNode.id);
    setResults(null);
  }, [nodes, edges, activePort]);

  // ─── Move node ──────────────────────────────────────────────────────────────
  const handleNodeMove = useCallback((id, x, y) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  // ─── Select port ────────────────────────────────────────────────────────────
  const handlePortClick = useCallback((nodeId, portId) => {
    setActivePort({ nodeId, portId });
    setSelectedId(nodeId);
  }, []);

  // ─── Update node props ──────────────────────────────────────────────────────
  const handleUpdateProps = useCallback((props) => {
    if (!selectedId) return;
    setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, props: { ...n.props, ...props } } : n));
    setResults(null);
  }, [selectedId]);

  // ─── Rotate node ────────────────────────────────────────────────────────────
  const handleRotate = useCallback((id) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, rotation: ((n.rotation || 0) + 90) % 360 } : n));
    setResults(null);
  }, []);

  // ─── Delete node ────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId || selectedId === 'pump-0') return;
    setNodes(prev => prev.filter(n => n.id !== selectedId));
    setEdges(prev => prev.filter(e => e.fromNodeId !== selectedId && e.toNodeId !== selectedId));
    if (activePort?.nodeId === selectedId) setActivePort({ nodeId: 'pump-0', portId: 'out' });
    setSelectedId(null);
    setResults(null);
  }, [selectedId, activePort]);

  // ─── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!confirm('Очистить всю схему?')) return;
    resetUid();
    setNodes([{ ...INIT_PUMP }]);
    setEdges([]);
    setSelectedId(null);
    setActivePort({ nodeId: 'pump-0', portId: 'out' });
    setResults(null);
  }, []);

  // ─── Calculate ──────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const res = calcHydraulicGraph(nodes, edges, globalParams);
    if (res.error) { toast.error(res.error); return; }
    setResults(res.elementResults);
    toast.success(
      `Расчёт выполнен. Насос: H=${res.pumpHead.toFixed(2)} м вод.ст., Q=${res.pumpFlow.toFixed(1)} л/мин`
    );
  }, [nodes, edges, globalParams]);

  // ─── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    if (!results) { toast.error('Сначала выполните расчёт'); return; }

    const doc = new jsPDF('l', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth();
    const pSpec = PIPE_TYPES[globalParams.pipeType];

    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text('Гидравлический расчёт системы отопления', W / 2, 14, { align: 'center' });
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Тип труб: ${pSpec?.name}   |   Подача: ${globalParams.tSupply}°C   |   Обратка: ${globalParams.tReturn}°C`, W / 2, 21, { align: 'center' });

    const pump = results['pump-0'];
    if (pump) {
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(`Насос:  Q = ${pump.flowRate?.toFixed(1)} л/мин   H = ${pump.head?.toFixed(2)} м   ΔP = ${(pump.pressure / 1000)?.toFixed(2)} кПа`, 14, 30);
      doc.setFont(undefined, 'normal');
    }

    const headers = ['Элемент', 'Помещение', 'Расход л/мин', 'Диаметр мм', 'Скорость м/с', 'ΔP, Па'];
    const colW = [55, 45, 28, 32, 30, 26];
    const startX = 14; let y = 40;

    doc.setFontSize(8);
    doc.setFillColor(219, 234, 254);
    doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 7, 'F');
    headers.forEach((h, i) => {
      doc.setFont(undefined, 'bold');
      doc.text(h, startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + 1, y);
    });
    y += 8; doc.setFont(undefined, 'normal');

    nodes.forEach((el, idx) => {
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
        row[5] = `${res.pressureLossPass?.toFixed(0)}/${res.pressureLossBranch?.toFixed(0)}`;
      } else if (el.type === 'elbow') {
        row[0] = 'Угол 90°'; row[3] = res.size ? `Ø${res.size.outer}` : '-'; row[5] = res.pressureLoss?.toFixed(0);
      } else if (el.type === 'radiator') {
        row[0] = 'Радиатор'; row[1] = el.props?.roomName || ''; row[2] = res.flowRate?.toFixed(3);
      }
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 7, 'F'); }
      row.forEach((cell, i) => doc.text(String(cell || '-'), startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + 1, y));
      y += 7;
      if (y > 190) { doc.addPage(); y = 20; }
    });

    doc.save('hydraulic-calc.pdf');
  }, [results, nodes, globalParams]);

  return (
    <div className="h-screen flex flex-col" style={{ overflow: 'hidden', background: '#0f172a' }}>
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 shrink-0 z-10"
        style={{ background: '#0f172a', borderBottom: '1px solid #1e3a5f' }}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg" style={{ background: '#1e3a5f' }}>
            <Flame className="w-4 h-4" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div className="text-sm font-bold leading-none" style={{ color: '#e2e8f0' }}>HydroCalc</div>
            <div className="text-[10px]" style={{ color: '#334155' }}>Графовая гидравлическая модель</div>
          </div>
        </div>

        <div className="h-6 w-px mx-1" style={{ background: '#1e3a5f' }} />

        <div className="flex items-center gap-2 text-xs">
          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Тип труб:</Label>
          <Select value={globalParams.pipeType} onValueChange={v => { setGlobalParams(p => ({ ...p, pipeType: v })); setResults(null); }}>
            <SelectTrigger className="h-7 text-xs w-52" style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PIPE_TYPES).map(([key, s]) => (
                <SelectItem key={key} value={key} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Подача °C:</Label>
          <Input type="number" value={globalParams.tSupply}
            onChange={e => setGlobalParams(p => ({ ...p, tSupply: +e.target.value }))}
            className="h-7 w-14 text-xs" style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }} />
          <Label className="text-xs shrink-0" style={{ color: '#475569' }}>Обратка °C:</Label>
          <Input type="number" value={globalParams.tReturn}
            onChange={e => setGlobalParams(p => ({ ...p, tReturn: +e.target.value }))}
            className="h-7 w-14 text-xs" style={{ background: '#1e293b', borderColor: '#1e3a5f', color: '#94a3b8' }} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-xs h-8" style={{ color: '#64748b' }}>
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить
          </Button>
          <Button onClick={handleCalculate} size="sm" className="gap-1.5 text-xs h-8">
            <Play className="w-3.5 h-3.5" /> Расчёт
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1.5 text-xs h-8"
            disabled={!results} style={{ borderColor: '#1e3a5f', color: '#64748b' }}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </header>

      {/* Hint bar */}
      {!results && (
        <div className="px-4 py-1.5 text-[11px] flex items-center gap-2 shrink-0"
          style={{ background: '#1e293b', borderBottom: '1px solid #1e3a5f', color: '#475569' }}>
          <HelpCircle className="w-3 h-3 shrink-0" style={{ color: '#3b82f6' }} />
          Кликните на <span className="font-semibold" style={{ color: '#4ade80' }}>зелёную точку</span> — выбрать порт подключения.
          Кнопка <span style={{ color: '#93c5fd' }}>↻</span> на выбранном — повернуть. Del — удалить.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ElementPanel onAddElement={handleAddElement} />

        <div className="flex-1 relative overflow-hidden">
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            activePort={activePort}
            selectedId={selectedId}
            results={results}
            onNodeMove={handleNodeMove}
            onNodeClick={setSelectedId}
            onPortClick={handlePortClick}
            onRotate={handleRotate}
          />
        </div>

        <div className="w-60 overflow-y-auto shrink-0"
          style={{ background: '#0f172a', borderLeft: '1px solid #1e3a5f' }}>
          <GraphInspector
            node={selectedNode}
            results={selectedNode ? results?.[selectedNode.id] : null}
            onUpdate={handleUpdateProps}
            onDelete={handleDelete}
            onRotate={handleRotate}
          />
        </div>
      </div>
    </div>
  );
}