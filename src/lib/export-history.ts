'use client';

import type { ProgressLog } from '@/types';

/**
 * 匯出單一子專案的歷史週報到 Excel
 */
export async function exportHistoryToExcel(
  logs: ProgressLog[],
  subProjectName: string,
  projectCaseNumber: string
) {
  const ExcelJS = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'YPE-Control';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('歷史週報', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
  });

  const columns = [
    { header: '提報區間', key: 'period', width: 20 },
    { header: '本週執行摘要', key: 'summary', width: 50 },
    { header: '下週工作計畫', key: 'nextPlan', width: 40 },
    { header: '遭遇問題及風險', key: 'roadblocks', width: 40 },
    { header: '完成度(%)', key: 'percentage', width: 14 },
    { header: '提報人', key: 'reporter', width: 14 },
    { header: '更新時間', key: 'updatedAt', width: 20 },
  ];
  ws.columns = columns;

  const totalCols = columns.length;

  // ── Row 1: Title ──
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell('A1');
  titleCell.value = `${projectCaseNumber} ${subProjectName} - 歷史週報`;
  titleCell.font = { name: '微軟正黑體', size: 14, bold: true, color: { argb: '001F4E79' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // ── Row 2: Date ──
  ws.mergeCells(2, totalCols - 1, 2, totalCols);
  const metaCell = ws.getCell(2, totalCols - 1);
  const now = new Date();
  metaCell.value = `匯出日期: ${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  metaCell.font = { name: '微軟正黑體', size: 9, color: { argb: '00666666' } };
  metaCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // ── Row 3: Headers ──
  const headerRow = ws.getRow(3);
  const headerBg = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '001F4E79' } };
  const headerFont = { name: '微軟正黑體', size: 10, bold: true, color: { argb: '00FFFFFF' } };

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = headerBg;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
      bottom: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
      left: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
      right: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
    };
  });
  headerRow.height = 28;

  // ── Data rows (newest first) ──
  const border = {
    top: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    bottom: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    left: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    right: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
  };

  logs.forEach((log, idx) => {
    const rowNum = 4 + idx;
    const row = ws.getRow(rowNum);
    const dataFont = { name: '微軟正黑體', size: 9, color: { argb: '00333333' } };

    const cells = [
      log.reportingPeriod || formatDate(log.updatedAt),
      log.executionSummary || '',
      log.nextWeekPlan || '',
      log.roadblocks || '無',
      `${log.completionPercentage}%`,
      log.createdByName || log.createdBy || '',
      formatDateTime(log.updatedAt),
    ];

    cells.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = dataFont;
      cell.alignment = { vertical: 'top' as const, wrapText: true };
      cell.border = border;
    });

    // Highlight roadblocks with red
    const roadblockVal = log.roadblocks;
    if (roadblockVal && roadblockVal !== '無' && roadblockVal.trim() !== '') {
      const cell = row.getCell(4);
      cell.font = { ...dataFont, color: { argb: '00CC0000' } };
    }

    // Alternating row background
    if (idx % 2 === 1) {
      for (let c = 1; c <= totalCols; c++) {
        row.getCell(c).fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '00F7F9FC' } };
      }
    }

    row.height = 50;
  });

  // ── Download ──
  const fileName = `${projectCaseNumber}_${subProjectName}_歷史週報.xlsx`;

  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error('匯出歷史紀錄失敗:', err);
    alert('匯出失敗，請再試一次');
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
