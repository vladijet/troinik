/**
 * ResultsDialog — попап с результатами расчёта и рекомендацией насоса Shinhoo
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';

const D = {
  bg: '#0f172a', card: '#1e293b', border: '#1e3a5f',
  text: '#94a3b8', bright: '#e2e8f0', muted: '#475569',
  accent: '#3b82f6', green: '#34d399', warn: '#fbbf24', red: '#f87171',
};

// База данных насосов Shinhoo (H_max в метрах, Q_max в л/мин)
const SHINHOO_PUMPS = [
  { model: 'Shinhoo Master S 25-4',   series: 'Master S', H_max: 4,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для частных домов до ~150 м²' },
  { model: 'Shinhoo Master S 25-6',   series: 'Master S', H_max: 6,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для частных домов до ~250 м²' },
  { model: 'Shinhoo Master S 25-8',   series: 'Master S', H_max: 8,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для коттеджей до ~350 м²' },
  { model: 'Shinhoo MEGA 25-6',       series: 'MEGA',     H_max: 6,  Q_max: 40,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, A-класс' },
  { model: 'Shinhoo MEGA 25-8',       series: 'MEGA',     H_max: 8,  Q_max: 40,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, A-класс' },
  { model: 'Shinhoo MEGA 32-8',       series: 'MEGA',     H_max: 8,  Q_max: 65,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, большой расход' },
  { model: 'Shinhoo MEGA 32-12',      series: 'MEGA',     H_max: 12, Q_max: 65,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, высокий напор' },
  { model: 'Shinhoo Standard 25-6',   series: 'Standard', H_max: 6,  Q_max: 30,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический надёжный насос' },
  { model: 'Shinhoo Standard 25-8',   series: 'Standard', H_max: 8,  Q_max: 30,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический надёжный насос' },
  { model: 'Shinhoo Standard 32-8',   series: 'Standard', H_max: 8,  Q_max: 55,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический насос, увеличенный расход' },
];

function selectPump(pumpHead, pumpFlow) {
  // Запас 20% по напору и расходу
  const H_req = pumpHead * 1.2;
  const Q_req = pumpFlow * 1.2;
  const suitable = SHINHOO_PUMPS.filter(p => p.H_max >= H_req && p.Q_max >= Q_req);
  if (!suitable.length) return null;
  // Выбираем наиболее подходящий (минимальный запас)
  return suitable.sort((a, b) => (a.H_max + a.Q_max) - (b.H_max + b.Q_max))[0];
}

function Row({ label, value, unit, highlight }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: D.border }}>
      <span style={{ fontSize: 12, color: D.text }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: highlight || D.bright }}>
        {value} <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>{unit}</span>
      </span>
    </div>
  );
}

function ElementResultRow({ id, res, nodes, edges }) {
  const node = nodes?.find(n => n.id === id);
  const edge = edges?.find(e => e.id === id);
  if (!node && !edge) return null;

  if (node) {
    const label = node.type === 'radiator'
      ? `Радиатор ${node.props?.roomName || node.id}`
      : node.type === 'pump' ? 'Насос' : node.type === 'tee' ? 'Тройник' : 'Угол 90°';
    return (
      <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: D.border + '55', fontSize: 11 }}>
        <span style={{ color: D.muted }}>{label}</span>
        <span style={{ fontFamily: 'monospace', color: D.text }}>
          {node.type === 'radiator' && res.flowRate != null && `Q=${res.flowRate.toFixed(2)} л/мин`}
          {node.type === 'pump' && res.head != null && `H=${res.head.toFixed(2)} м · Q=${res.flowRate?.toFixed(1)} л/мин`}
          {['tee','elbow'].includes(node.type) && res.pressureLossPass != null && `ΔP=${res.pressureLossPass?.toFixed(0)} Па`}
          {['tee','elbow'].includes(node.type) && res.pressureLoss != null && `ΔP=${res.pressureLoss?.toFixed(0)} Па`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: D.border + '55', fontSize: 11 }}>
      <span style={{ color: D.muted }}>Труба {edge.id}</span>
      <span style={{ fontFamily: 'monospace', color: D.text }}>
        {res.size && `Ø${res.size.outer}×${res.size.wall} · `}{res.velocity?.toFixed(2)} м/с · ΔP={res.pressureLoss?.toFixed(0)} Па
      </span>
    </div>
  );
}

function buildSpecification(nodes, edges) {
  const radiatorCount = (nodes || []).filter(n => n.type === 'radiator').length;
  const teeCount      = (nodes || []).filter(n => n.type === 'tee').length;
  const elbowCount    = (nodes || []).filter(n => n.type === 'elbow').length;
  const hasPump       = (nodes || []).some(n => n.type === 'pump');

  // Группируем трубы по типоразмеру (outer×wall)
  const pipeGroups = {};
  (edges || []).forEach(e => {
    const res_size = null; // размер берётся из results, передаём снаружи
    const lenOne = parseFloat(e.pipeProps?.length) || 0;
    pipeGroups['total'] = (pipeGroups['total'] || 0) + lenOne * 2;
  });

  return [
    { name: 'Циркуляционный насос',          qty: hasPump ? 1 : 0,           unit: 'шт' },
    { name: 'Узел нижнего подключения (H-блок)', qty: radiatorCount,          unit: 'компл.' },
    { name: 'Соединение трубы (фитинг)',       qty: radiatorCount * 2,        unit: 'шт' },
    { name: 'Тройник',                         qty: teeCount,                 unit: 'шт' },
    { name: 'Угол 90°',                        qty: elbowCount,               unit: 'шт' },
  ];
}

function buildPipeSpec(edges, results) {
  // Группируем длины по типоразмеру трубы
  const groups = {};
  (edges || []).forEach(e => {
    const res = results?.[e.id];
    const key = res?.size ? `Ø${res.size.outer}×${res.size.wall} мм` : 'Не рассчитано';
    const lenOne = parseFloat(e.pipeProps?.length) || 0;
    groups[key] = (groups[key] || 0) + lenOne * 2; // ×2 подача+обратка
  });
  return Object.entries(groups).map(([size, len]) => ({ size, len }));
}

export default function ResultsDialog({ open, onClose, results, pumpHead, pumpFlow, nodes, edges, globalParams }) {
  if (!results) return null;

  const pump = nodes?.find(n => n.type === 'pump');
  const pumpRes = pump ? results[pump.id] : null;
  const H = pumpHead ?? pumpRes?.head ?? 0;
  const Q = pumpFlow ?? pumpRes?.flowRate ?? 0;
  const recommended = selectPump(H, Q);
  const specification = buildSpecification(nodes, edges);
  const pipeSpec = buildPipeSpec(edges, results);

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 20;

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 95);
    doc.text('HydroCalc — Результаты расчёта', W / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, W / 2, y, { align: 'center' });
    y += 8;

    // Параметры системы
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text('Параметры системы', 20, y);
    y += 6;
    doc.setDrawColor(30, 58, 95);
    doc.line(20, y, W - 20, y);
    y += 6;

    const sysRows = [
      ['Тип труб',        globalParams?.pipeType || '—'],
      ['Температура подачи', `${globalParams?.tSupply || '—'} °C`],
      ['Температура обратки', `${globalParams?.tReturn || '—'} °C`],
      ['Расчётный напор насоса', `${H.toFixed(2)} м вод.ст.`],
      ['Расчётный расход насоса', `${Q.toFixed(2)} л/мин`],
    ];

    doc.setFontSize(10);
    sysRows.forEach(([label, val]) => {
      doc.setTextColor(71, 85, 105);
      doc.text(label, 22, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text(val, W - 22, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 6;
    });
    y += 4;

    // Результаты по элементам
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text('Результаты по элементам', 20, y);
    y += 6;
    doc.line(20, y, W - 20, y);
    y += 6;

    doc.setFontSize(9);
    Object.entries(results).forEach(([id, res]) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const node = nodes?.find(n => n.id === id);
      const edge = edges?.find(e => e.id === id);
      let label = id;
      let valueStr = '';

      if (node) {
        label = node.type === 'radiator'
          ? `Радиатор: ${node.props?.roomName || id}`
          : node.type === 'pump' ? 'Насос' : node.type === 'tee' ? 'Тройник' : 'Угол 90°';
        if (node.type === 'radiator') valueStr = `Q=${res.flowRate?.toFixed(2)} л/мин, ΔP=${res.pressureLoss?.toFixed(0)} Па`;
        if (node.type === 'pump') valueStr = `H=${res.head?.toFixed(2)} м, Q=${res.flowRate?.toFixed(1)} л/мин`;
        if (['tee','elbow'].includes(node.type)) valueStr = `ΔP=${(res.pressureLossPass ?? res.pressureLoss ?? 0).toFixed(0)} Па`;
      } else if (edge) {
        label = `Труба ${id}`;
        valueStr = `Ø${res.size?.outer}×${res.size?.wall}, ${res.velocity?.toFixed(2)} м/с, ΔP=${res.pressureLoss?.toFixed(0)} Па`;
      }

      doc.setTextColor(71, 85, 105);
      doc.text(label, 22, y);
      doc.setTextColor(30, 41, 59);
      doc.text(valueStr, W - 22, y, { align: 'right' });
      y += 5.5;
    });
    y += 4;

    // Спецификация материалов
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text('Спецификация материалов', 20, y);
    y += 6;
    doc.line(20, y, W - 20, y);
    y += 6;
    doc.setFontSize(10);
    pipeSpec.forEach(({ size, len }) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(71, 85, 105);
      doc.text(`Труба ${size}`, 22, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text(`${len.toFixed(1)} м`, W - 22, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 6;
    });
    specification.forEach(item => {
      if (item.qty <= 0) return;
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(71, 85, 105);
      doc.text(item.name, 22, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text(`${item.qty} ${item.unit}`, W - 22, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 6;
    });
    y += 4;

    // Рекомендация насоса
    if (recommended) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 95);
      doc.text('Рекомендуемый насос', 20, y);
      y += 6;
      doc.line(20, y, W - 20, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text(recommended.model, 22, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(recommended.desc, 22, y);
      y += 5;
      doc.text(`Макс. напор: ${recommended.H_max} м  |  Макс. расход: ${recommended.Q_max} л/мин`, 22, y);
      y += 5;
      doc.setTextColor(59, 130, 246);
      doc.text(recommended.url, 22, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Сгенерировано HydroCalc · shinhoopump.ru', W / 2, 290, { align: 'center' });

    doc.save('hydrocalc-results.pdf');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto"
        style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.bright }}>
        <DialogHeader>
          <DialogTitle style={{ color: D.bright, fontSize: 16 }}>Результаты гидравлического расчёта</DialogTitle>
        </DialogHeader>

        {/* Ключевые параметры */}
        <div className="rounded-lg p-4 space-y-1" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Параметры насоса</p>
          <Row label="Расчётный напор (H)" value={H.toFixed(2)} unit="м вод.ст." highlight={D.accent} />
          <Row label="Расчётный расход (Q)" value={Q.toFixed(2)} unit="л/мин" highlight={D.green} />
          <Row label="Температура подачи" value={globalParams?.tSupply} unit="°C" />
          <Row label="Температура обратки" value={globalParams?.tReturn} unit="°C" />
          <Row label="Тип труб" value={globalParams?.pipeType} unit="" />
        </div>

        {/* Детали по элементам */}
        <div className="rounded-lg p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Элементы схемы</p>
          {Object.entries(results).map(([id, res]) => (
            <ElementResultRow key={id} id={id} res={res} nodes={nodes} edges={edges} />
          ))}
        </div>

        {/* Спецификация материалов */}
        <div className="rounded-lg p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Спецификация материалов</p>
          {/* Трубы по типоразмерам */}
          {pipeSpec.map(({ size, len }) => (
            <div key={size} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: D.border }}>
              <span style={{ fontSize: 12, color: D.text }}>Труба {size}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: D.warn }}>
                {len.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>м</span>
              </span>
            </div>
          ))}
          {/* Остальные позиции */}
          {specification.map(item => item.qty > 0 && (
            <div key={item.name} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: D.border }}>
              <span style={{ fontSize: 12, color: D.text }}>{item.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: D.bright }}>
                {item.qty} <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>{item.unit}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Рекомендация насоса */}
        {recommended ? (
          <div className="rounded-lg p-4 space-y-2" style={{ background: '#0a1929', border: `1px solid ${D.accent}44` }}>
            <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Рекомендуемый насос Shinhoo</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: D.accent }}>{recommended.model}</p>
                <p style={{ fontSize: 11, color: D.text, marginTop: 2 }}>{recommended.desc}</p>
                <div className="flex gap-4 mt-2">
                  <span style={{ fontSize: 11, color: D.muted }}>Макс. напор: <b style={{ color: D.bright }}>{recommended.H_max} м</b></span>
                  <span style={{ fontSize: 11, color: D.muted }}>Макс. расход: <b style={{ color: D.bright }}>{recommended.Q_max} л/мин</b></span>
                </div>
                <p style={{ fontSize: 10, color: D.muted, marginTop: 4 }}>
                  Расчётные параметры с запасом 20%: H≥{(H * 1.2).toFixed(1)} м, Q≥{(Q * 1.2).toFixed(1)} л/мин
                </p>
              </div>
              <a href={recommended.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0 text-xs"
                  style={{ borderColor: D.accent, color: D.accent, background: 'transparent' }}>
                  <ExternalLink className="w-3 h-3" /> Подробнее
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-4 text-center" style={{ background: D.card, border: `1px solid ${D.warn}44` }}>
            <p style={{ fontSize: 12, color: D.warn }}>
              Параметры системы превышают стандартный диапазон. Обратитесь к специалисту.
            </p>
            <a href="https://shinhoopump.ru/product/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs" style={{ color: D.accent }}>
              <ExternalLink className="w-3 h-3" /> Весь каталог Shinhoo
            </a>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleDownloadPDF} className="flex-1 gap-2"
            style={{ background: D.accent }}>
            <Download className="w-4 h-4" /> Скачать PDF
          </Button>
          <Button variant="outline" onClick={onClose} className="text-xs"
            style={{ borderColor: D.border, color: D.muted, background: 'transparent' }}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}