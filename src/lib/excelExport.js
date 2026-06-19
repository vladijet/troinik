/**
 * Экспорт результатов гидравлического расчёта в Excel (xlsx).
 * Три листа: Параметры, Спецификация, Детализация элементов.
 */
import * as XLSX from 'xlsx';

export function exportResultsToExcel({
  results, nodes, edges, globalParams, specification, pipeSpec,
  pumpHead, pumpFlow, recommended, pipeTypeLabel,
}) {
  const wb = XLSX.utils.book_new();

  // ── Лист 1: Параметры системы ──────────────────────────────────────────
  const paramRows = [
    ['Параметр', 'Значение'],
    ['Материал труб', pipeTypeLabel || '-'],
    ['Температура подачи, °C', globalParams?.tSupply ?? '-'],
    ['Температура обратки, °C', globalParams?.tReturn ?? '-'],
    ['Температура воздуха, °C', globalParams?.tAir ?? '-'],
    ['Расчётный напор H, м', pumpHead != null ? +pumpHead.toFixed(2) : '-'],
    ['Расчётный расход Q, л/мин', pumpFlow != null ? +pumpFlow.toFixed(2) : '-'],
    ['Рекомендуемый насос', recommended ? recommended.model : 'см. каталог'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(paramRows);
  ws1['!cols'] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Параметры');

  // ── Лист 2: Спецификация материалов ────────────────────────────────────
  const specRows = [['Наименование', 'Кол-во', 'Ед.']];
  (pipeSpec || []).forEach(({ size, len }) => specRows.push([size, +len.toFixed(1), 'м']));
  (specification || []).forEach(item => {
    if (item.qty > 0) specRows.push([item.name, item.qty, item.unit]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(specRows);
  ws2['!cols'] = [{ wch: 52 }, { wch: 10 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Спецификация');

  // ── Лист 3: Детализация по элементам ───────────────────────────────────
  const detRows = [['Элемент', 'Диаметр', 'Расход, л/мин', 'Скорость, м/с', 'ΔP, Па']];
  Object.entries(results || {}).forEach(([id, res]) => {
    const node = nodes?.find(n => n.id === id);
    const edge = edges?.find(e => e.id === id);
    let label = id, size = '', flow = '', vel = '', dp = '';
    if (node) {
      label = node.type === 'radiator' ? `Радиатор: ${node.props?.roomName || id}`
        : node.type === 'pump' ? 'Насос' : node.type === 'tee' ? 'Тройник' : 'Угол 90°';
      size = res.size ? `Ø${res.size.outer}×${res.size.wall}` : '';
      flow = res.flowRate != null ? +res.flowRate.toFixed(2) : '';
      if (node.type === 'pump') dp = res.pressure != null ? +res.pressure.toFixed(0) : '';
      else {
        const v = res.pressureLossPass ?? res.pressureLoss;
        dp = v != null ? +v.toFixed(0) : '';
      }
    } else if (edge) {
      label = `Труба ${id}`;
      size = res.size ? `Ø${res.size.outer}×${res.size.wall}` : '';
      flow = res.flowRate != null ? +res.flowRate.toFixed(2) : '';
      vel = res.velocity != null ? +res.velocity.toFixed(3) : '';
      dp = res.pressureLoss != null ? +res.pressureLoss.toFixed(0) : '';
    }
    detRows.push([label, size, flow, vel, dp]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(detRows);
  ws3['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Детализация');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  XLSX.writeFile(wb, `Troinik_results_${dd}_${mm}_${yyyy}.xlsx`);
}