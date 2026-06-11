/**
 * ResultsDialog — попап с результатами расчёта, рекомендацией насоса Shinhoo
 * PDF: landscape A4, Roboto (кириллица), схема на стр.1, данные на стр.2+
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const D = {
  bg: '#0f172a', card: '#1e293b', border: '#1e3a5f',
  text: '#94a3b8', bright: '#e2e8f0', muted: '#475569',
  accent: '#3b82f6', green: '#34d399', warn: '#fbbf24', red: '#f87171',
};

// База данных насосов Shinhoo
const SHINHOO_PUMPS = [
  { model: 'Shinhoo Master S 25-4',   H_max: 4,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для частных домов до ~150 м²' },
  { model: 'Shinhoo Master S 25-6',   H_max: 6,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для частных домов до ~250 м²' },
  { model: 'Shinhoo Master S 25-8',   H_max: 8,  Q_max: 25,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/master-s/', desc: 'Регулируемый, для коттеджей до ~350 м²' },
  { model: 'Shinhoo MEGA 25-6',       H_max: 6,  Q_max: 40,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, A-класс' },
  { model: 'Shinhoo MEGA 25-8',       H_max: 8,  Q_max: 40,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, A-класс' },
  { model: 'Shinhoo MEGA 32-8',       H_max: 8,  Q_max: 65,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, большой расход' },
  { model: 'Shinhoo MEGA 32-12',      H_max: 12, Q_max: 65,  url: 'https://shinhoopump.ru/product/energoeffektivnye_nasosy/mega/',     desc: 'Высокоэффективный EC-мотор, высокий напор' },
  { model: 'Shinhoo Standard 25-6',   H_max: 6,  Q_max: 30,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический надёжный насос' },
  { model: 'Shinhoo Standard 25-8',   H_max: 8,  Q_max: 30,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический надёжный насос' },
  { model: 'Shinhoo Standard 32-8',   H_max: 8,  Q_max: 55,  url: 'https://shinhoopump.ru/product/standart_nasosy/',                   desc: 'Классический насос, увеличенный расход' },
];

function selectPump(pumpHead, pumpFlow) {
  const H_req = pumpHead * 1.2;
  const Q_req = pumpFlow * 1.2;
  const suitable = SHINHOO_PUMPS.filter(p => p.H_max >= H_req && p.Q_max >= Q_req);
  if (!suitable.length) return null;
  return suitable.sort((a, b) => (a.H_max + a.Q_max) - (b.H_max + b.Q_max))[0];
}

const RADIATOR_ADAPTER = {
  ppr_pn20:      { short: 'Муфта "Американка" ПП/Евроконус 3/4"' },
  ppr_pn25:      { short: 'Муфта "Американка" ПП/Евроконус 3/4"' },
  pex:           { short: 'Евроконус обжимной PEX, 3/4"' },
  metal_plastic: { short: 'Евроконус с диэл. прокладкой МП, 3/4"' },
  stainless:     { short: 'Обжимной адаптер нерж./Евроконус 3/4"' },
};

const PIPE_TYPE_LABELS = {
  ppr_pn20:      'PPR PN20',
  ppr_pn25:      'PPR PN25',
  pex:           'PEX',
  metal_plastic: 'PEX-Al-PEX',
  stainless:     'Нерж. сталь',
};

const FITTING_NAMES = {
  ppr_pn20:      { tee: 'Тройник PPR PN20 (под пайку)', elbow: 'Угол 90° PPR PN20 (под пайку)' },
  ppr_pn25:      { tee: 'Тройник PPR PN25 (под пайку)', elbow: 'Угол 90° PPR PN25 (под пайку)' },
  pex:           { tee: 'Тройник аксиальный PEX', elbow: 'Угол 90° аксиальный PEX' },
  metal_plastic: { tee: 'Тройник пресс-фитинг PEX-Al-PEX', elbow: 'Угол 90° пресс-фитинг PEX-Al-PEX' },
  stainless:     { tee: 'Тройник пресс Нерж. сталь', elbow: 'Угол 90° пресс Нерж. сталь' },
};

function getNodeEdgeDiameters(nodeId, edges, results) {
  return (edges || [])
    .filter(e => e.fromNodeId === nodeId || e.toNodeId === nodeId)
    .map(e => results?.[e.id]?.size?.outer)
    .filter(Boolean);
}

function normalizedTeeKey(diameters) {
  const sorted = [...diameters].sort((a, b) => b - a);
  if (sorted.length < 3) return sorted.join('×') + ' мм';
  return `${sorted[0]}×${sorted[1]}×${sorted[2]} мм`;
}

function normalizedElbowKey(diameters) {
  if (diameters.length < 2) return (diameters[0] || '?') + ' мм';
  const sorted = [...diameters].sort((a, b) => b - a);
  return sorted[0] === sorted[1] ? `${sorted[0]} мм` : `${sorted[0]}×${sorted[1]} мм`;
}

function buildSpecification(nodes, edges, results, pipeType) {
  const radiatorCount = (nodes || []).filter(n => n.type === 'radiator').length;
  const hasPump       = (nodes || []).some(n => n.type === 'pump');
  const fittings      = FITTING_NAMES[pipeType] || FITTING_NAMES.ppr_pn20;
  const adapter       = RADIATOR_ADAPTER[pipeType] || RADIATOR_ADAPTER.ppr_pn20;

  const teeGroups = {};
  (nodes || []).filter(n => n.type === 'tee').forEach(n => {
    const key = `${fittings.tee} ${normalizedTeeKey(getNodeEdgeDiameters(n.id, edges, results))}`;
    teeGroups[key] = (teeGroups[key] || 0) + 1;
  });

  const elbowGroups = {};
  (nodes || []).filter(n => n.type === 'elbow').forEach(n => {
    const key = `${fittings.elbow} ${normalizedElbowKey(getNodeEdgeDiameters(n.id, edges, results))}`;
    elbowGroups[key] = (elbowGroups[key] || 0) + 1;
  });

  const items = [];
  if (hasPump) items.push({ name: 'Циркуляционный насос', qty: 1, unit: 'шт' });
  if (radiatorCount > 0) {
    items.push({ name: 'Узел нижнего подключения радиатора 3/4"', qty: radiatorCount, unit: 'компл.' });
    items.push({ name: adapter.short, qty: radiatorCount * 2, unit: 'шт' });
  }
  Object.entries(teeGroups).forEach(([name, qty]) => items.push({ name, qty, unit: 'шт' }));
  Object.entries(elbowGroups).forEach(([name, qty]) => items.push({ name, qty, unit: 'шт' }));
  return items;
}

function buildPipeSpec(edges, results, pipeType) {
  const typeLabel = PIPE_TYPE_LABELS[pipeType] || pipeType || '';
  const groups = {};
  (edges || []).forEach(e => {
    const res = results?.[e.id];
    const sizeStr = res?.size ? `Ø${res.size.outer}×${res.size.wall} мм` : 'Не рассчитано';
    const key = `Труба ${typeLabel} ${sizeStr}`;
    const lenOne = parseFloat(e.pipeProps?.length) || 0;
    groups[key] = (groups[key] || 0) + lenOne * 2;
  });
  return Object.entries(groups).map(([size, len]) => ({ size, len }));
}

// ─── UI вспомогательные ──────────────────────────────────────────────────────
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
          {['tee','elbow'].includes(node.type) && `ΔP=${(res.pressureLossPass ?? res.pressureLoss ?? 0).toFixed(0)} Па`}
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

// ─── PDF helpers ─────────────────────────────────────────────────────────────

// Транслитерация кириллицы → латиница для jsPDF (helvetica не поддерживает кириллицу)
function toAscii(str) {
  if (!str) return '';
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
    'и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
    'щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z',
    'И':'I','Й':'J','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R',
    'С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh',
    'Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
  };
  return str.split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

// Захватить SVG через html2canvas, вырезав реальный bounding box содержимого
async function captureGraphCanvas(svgEl) {
  // Вычисляем bounding box всего содержимого (не viewport)
  const contentGroup = svgEl.querySelector('g[transform]');
  let bbox = null;
  try {
    bbox = contentGroup ? contentGroup.getBBox() : null;
  } catch (e) { bbox = null; }

  // Получаем текущий transform (translate + scale)
  const transform = contentGroup?.getAttribute('transform') || '';
  const tMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
  const sMatch = transform.match(/scale\(([^)]+)\)/);
  const tx = tMatch ? parseFloat(tMatch[1]) : 0;
  const ty = tMatch ? parseFloat(tMatch[2]) : 0;
  const scale = sMatch ? parseFloat(sMatch[1]) : 1;

  const PAD = 40;
  let cropX = 0, cropY = 0, cropW = svgEl.clientWidth, cropH = svgEl.clientHeight;

  if (bbox && bbox.width > 0 && bbox.height > 0) {
    // Переводим bbox из canvas-координат в экранные
    cropX = Math.max(0, tx + bbox.x * scale - PAD);
    cropY = Math.max(0, ty + bbox.y * scale - PAD);
    const right  = Math.min(svgEl.clientWidth,  tx + (bbox.x + bbox.width)  * scale + PAD);
    const bottom = Math.min(svgEl.clientHeight, ty + (bbox.y + bbox.height) * scale + PAD);
    cropW = right - cropX;
    cropH = bottom - cropY;
  }

  // Рендерим весь SVG в canvas
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${svgEl.clientWidth}px;height:${svgEl.clientHeight}px;background:#0f172a;overflow:hidden;`;
  const clone = svgEl.cloneNode(true);
  clone.style.width = svgEl.clientWidth + 'px';
  clone.style.height = svgEl.clientHeight + 'px';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const fullCanvas = await html2canvas(wrapper, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
    logging: false,
    width: svgEl.clientWidth,
    height: svgEl.clientHeight,
  });
  document.body.removeChild(wrapper);

  // Вырезаем только область с содержимым
  const cropped = document.createElement('canvas');
  const dpr = 2;
  cropped.width  = cropW  * dpr;
  cropped.height = cropH * dpr;
  const ctx = cropped.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, cropped.width, cropped.height);
  ctx.drawImage(fullCanvas, cropX * dpr, cropY * dpr, cropW * dpr, cropH * dpr, 0, 0, cropped.width, cropped.height);

  return { imgData: cropped.toDataURL('image/png'), aspectRatio: cropH / cropW };
}

// Нарисовать горизонтальную линию-разделитель
function hLine(doc, y, W, color = [30, 58, 95]) {
  doc.setDrawColor(...color);
  doc.line(14, y, W - 14, y);
}

// Секция-заголовок
function sectionTitle(doc, text, y, W, font) {
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text(text, 14, y);
  hLine(doc, y + 2, W);
  return y + 8;
}

// Строка таблицы (label + value по правому краю)
function tableRow(doc, label, value, y, W, font, labelColor, valueColor) {
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...(labelColor || [71, 85, 105]));
  doc.text(label, 18, y);
  doc.setFont(font, 'bold');
  doc.setTextColor(...(valueColor || [30, 41, 59]));
  doc.text(value, W - 14, y, { align: 'right' });
  doc.setFont(font, 'normal');
  return y + 5.5;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ResultsDialog({ open, onClose, results, pumpHead, pumpFlow, nodes, edges, globalParams, canvasRef }) {
  const [exporting, setExporting] = useState(false);

  if (!results) return null;

  const pump = nodes?.find(n => n.type === 'pump');
  const pumpRes = pump ? results[pump.id] : null;
  const H = pumpHead ?? pumpRes?.head ?? 0;
  const Q = pumpFlow ?? pumpRes?.flowRate ?? 0;
  const recommended = selectPump(H, Q);
  const specification = buildSpecification(nodes, edges, results, globalParams?.pipeType);
  const pipeSpec = buildPipeSpec(edges, results, globalParams?.pipeType);

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      // ── Инициализация landscape A4 ──────────────────────────────────────
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297;
      const H_PAGE = 210;
      const MARGIN = 14;
      const font = 'helvetica'; // helvetica встроен в jsPDF, не требует загрузки

      // ══════════════════════════════════════════════════════════════════════
      // СТРАНИЦА 1 — Схема отопления
      // ══════════════════════════════════════════════════════════════════════
      const svgEl = canvasRef?.current;
      if (svgEl) {
        const { imgData, aspectRatio } = await captureGraphCanvas(svgEl);

        // Заголовок страницы
        doc.setFont(font, 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 95);
        doc.text('HydroCalc - Schema', W / 2, 10, { align: 'center' });
        doc.setFont(font, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date: ${new Date().toLocaleDateString('ru-RU')}`, W / 2, 16, { align: 'center' });

        // Вписываем схему полностью на страницу с сохранением пропорций
        const availW = W - MARGIN * 2;
        const availH = H_PAGE - 22;
        let imgW = availW;
        let imgH = imgW * aspectRatio;
        if (imgH > availH) {
          imgH = availH;
          imgW = imgH / aspectRatio;
        }
        const imgX = MARGIN + (availW - imgW) / 2;
        doc.addImage(imgData, 'PNG', imgX, 20, imgW, imgH);
      }

      // ══════════════════════════════════════════════════════════════════════
      // СТРАНИЦА 2 — Параметры системы + Результаты по элементам
      // ══════════════════════════════════════════════════════════════════════
      doc.addPage();
      let y = 14;

      // Заголовок
      doc.setFont(font, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 58, 95);
      doc.text('HydroCalc - Results', W / 2, y, { align: 'center' });
      y += 8;

      // Две колонки: левая — параметры системы, правая — насос
      const colW = (W - MARGIN * 2) / 2 - 5;
      const col2X = MARGIN + colW + 10;

      // Левая: Параметры системы
      doc.setFont(font, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 95);
      doc.text('System Parameters', MARGIN, y);
      doc.line(MARGIN, y + 2, MARGIN + colW, y + 2);

      // Правая: Параметры насоса
      doc.text('Pump Parameters', col2X, y);
      doc.line(col2X, y + 2, col2X + colW, y + 2);
      y += 8;

      const pipeTypeLabel = PIPE_TYPE_LABELS[globalParams?.pipeType] || globalParams?.pipeType || '-';
      const sysRows = [
        ['Pipe material',    pipeTypeLabel],
        ['Supply temp',      `${globalParams?.tSupply || '-'} C`],
        ['Return temp',      `${globalParams?.tReturn || '-'} C`],
        ['Air temp',         `${globalParams?.tAir || '-'} C`],
      ];
      const pumpRows = [
        ['Head (H)',         `${H.toFixed(2)} m`],
        ['Flow (Q)',         `${Q.toFixed(2)} l/min`],
        ['Recommended',     recommended ? recommended.model : 'see catalog'],
      ];

      const rowH = 5.5;
      sysRows.forEach(([lbl, val]) => {
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text(lbl, MARGIN + 2, y);
        doc.setFont(font, 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(val, MARGIN + colW, y, { align: 'right' });
        y += rowH;
      });

      let y2 = y - sysRows.length * rowH;
      pumpRows.forEach(([lbl, val]) => {
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text(lbl, col2X + 2, y2);
        doc.setFont(font, 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(val, col2X + colW, y2, { align: 'right' });
        y2 += rowH;
      });

      y = Math.max(y, y2) + 4;

      // Результаты по элементам
      y = sectionTitle(doc, 'Element Results', y, W, font);
      Object.entries(results).forEach(([id, res]) => {
        if (y > H_PAGE - 16) { doc.addPage(); y = 14; }
        const node = nodes?.find(n => n.id === id);
        const edge = edges?.find(e => e.id === id);
        let label = id, valueStr = '';
        if (node) {
          const roomName = toAscii(node.props?.roomName || id);
          label = node.type === 'radiator' ? `Radiator: ${roomName}`
            : node.type === 'pump' ? 'Pump'
            : node.type === 'tee' ? 'Tee' : 'Elbow 90';
          if (node.type === 'radiator') valueStr = `Q=${res.flowRate?.toFixed(2)} l/min, dP=${res.pressureLoss?.toFixed(0)} Pa`;
          if (node.type === 'pump') valueStr = `H=${res.head?.toFixed(2)} m, Q=${res.flowRate?.toFixed(1)} l/min`;
          if (['tee','elbow'].includes(node.type)) valueStr = `dP=${(res.pressureLossPass ?? res.pressureLoss ?? 0).toFixed(0)} Pa`;
        } else if (edge) {
          label = `Pipe ${id}`;
          valueStr = `${res.size?.outer}x${res.size?.wall}mm, ${res.velocity?.toFixed(2)} m/s, dP=${res.pressureLoss?.toFixed(0)} Pa`;
        }
        y = tableRow(doc, label, valueStr, y, W, font);
      });

      // ══════════════════════════════════════════════════════════════════════
      // СТРАНИЦА 3 — Спецификация + Рекомендация насоса
      // ══════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = 14;

      y = sectionTitle(doc, 'Bill of Materials', y, W, font);

      // Трубы
      pipeSpec.forEach(({ size, len }) => {
        if (y > H_PAGE - 16) { doc.addPage(); y = 14; }
        y = tableRow(doc, toAscii(size), `${len.toFixed(1)} m`, y, W, font, [71, 85, 105], [30, 41, 59]);
      });

      // Фитинги и оборудование
      specification.forEach(item => {
        if (item.qty <= 0) return;
        if (y > H_PAGE - 16) { doc.addPage(); y = 14; }
        const name = toAscii(item.name);
        const unit = toAscii(item.unit);
        const nameLines = doc.splitTextToSize(name, W - MARGIN * 2 - 50);
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text(nameLines, 18, y);
        doc.setFont(font, 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(`${item.qty} ${unit}`, W - MARGIN, y, { align: 'right' });
        y += 5.5 * nameLines.length;
      });

      y += 6;

      // Рекомендация насоса
      if (recommended) {
        if (y > H_PAGE - 30) { doc.addPage(); y = 14; }
        y = sectionTitle(doc, 'Recommended Pump - Shinhoo', y, W, font);
        doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(59, 130, 246);
        doc.text(recommended.model, 18, y); y += 6;
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text(toAscii(recommended.desc), 18, y); y += 5;
        doc.text(`Max head: ${recommended.H_max} m  |  Max flow: ${recommended.Q_max} l/min`, 18, y); y += 5;
        doc.text(`Required (x1.2): H >= ${(H * 1.2).toFixed(1)} m, Q >= ${(Q * 1.2).toFixed(1)} l/min`, 18, y); y += 5;
        doc.setTextColor(59, 130, 246);
        doc.text(recommended.url, 18, y);
      }

      // Нижний колонтитул на всех страницах
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont(font, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${totalPages}  -  HydroCalc  -  shinhoopump.ru`, W / 2, H_PAGE - 4, { align: 'center' });
      }

      doc.save('hydrocalc-results.pdf');
    } finally {
      setExporting(false);
    }
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
          <Row label="Тип труб" value={PIPE_TYPE_LABELS[globalParams?.pipeType] || globalParams?.pipeType} unit="" />
        </div>

        {/* Детали по элементам */}
        <div className="rounded-lg p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Элементы схемы</p>
          {Object.entries(results).map(([id, res]) => (
            <ElementResultRow key={id} id={id} res={res} nodes={nodes} edges={edges} />
          ))}
        </div>

        {/* Спецификация */}
        <div className="rounded-lg p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <p style={{ fontSize: 10, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Спецификация материалов</p>
          {pipeSpec.map(({ size, len }) => (
            <div key={size} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: D.border }}>
              <span style={{ fontSize: 12, color: D.text }}>{size}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: D.warn }}>
                {len.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>м</span>
              </span>
            </div>
          ))}
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
            <p style={{ fontSize: 12, color: D.warn }}>Параметры системы превышают стандартный диапазон. Обратитесь к специалисту.</p>
            <a href="https://shinhoopump.ru/product/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs" style={{ color: D.accent }}>
              <ExternalLink className="w-3 h-3" /> Весь каталог Shinhoo
            </a>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleDownloadPDF} disabled={exporting} className="flex-1 gap-2"
            style={{ background: D.accent }}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Генерация PDF...' : 'Скачать PDF'}
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