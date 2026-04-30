'use client';

import type { FullProject, SubProjectWithLatestLog } from '@/types';

/**
 * 匯出全專案最新進度總表 Excel
 * 
 * 格式：
 * - Row 1: 標題列（合併儲存格）
 * - Row 2: 製表單位 + 日期
 * - Row 3: 欄位標題（深藍底白字）
 * - Row 4+: 資料列，同一主專案的前 7 欄合併
 * - 結案/暫緩的專案用灰色字體
 * - 所有儲存格自動換行
 * - 依主專案序號降序排列（最大在最上面）
 */
export async function exportProjectsToExcel(projects: FullProject[]) {
  const ExcelJS = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'YPE-Control';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('全專案最新進度總表', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }], // Freeze header rows
  });

  // ── Column definitions ──
  const columns = [
    { header: '主專案案號', key: 'caseNumber', width: 14 },
    { header: '主專案名稱', key: 'projectName', width: 30 },
    { header: '專案目的', key: 'projectPurpose', width: 35 },
    { header: '現況/問題點', key: 'currentStatus', width: 35 },
    { header: '燁輝專案負責主管與分機', key: 'manager', width: 26 },
    { header: 'TPM管理室窗口', key: 'tpm', width: 18 },
    { header: '億威電子', key: 'egiga', width: 15 },
    { header: '子專案名稱', key: 'subName', width: 30 },
    { header: '本週執行摘要', key: 'summary', width: 50 },
    { header: '下週工作計畫', key: 'nextPlan', width: 40 },
    { header: '遭遇問題及風險', key: 'roadblocks', width: 40 },
    { header: '總體完成度(%)', key: 'percentage', width: 15 },
    { header: '預計完成日', key: 'expectedDate', width: 14 },
    { header: '實際完成日', key: 'actualDate', width: 14 },
  ];
  ws.columns = columns;

  const totalCols = columns.length; // 14 columns = A to N

  // ── Row 1: Title ──
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell('A1');
  titleCell.value = '燁輝智慧製造執行方案進度管制表 - 全專案最新進度';
  titleCell.font = { name: '微軟正黑體', size: 16, bold: true, color: { argb: '001F4E79' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // ── Row 2: Meta info ──
  ws.mergeCells(2, 1, 2, 3);
  const metaLeftCell = ws.getCell('A2');
  metaLeftCell.value = '製表單位: TPM管理室';
  metaLeftCell.font = { name: '微軟正黑體', size: 10, color: { argb: '00333333' } };
  metaLeftCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells(2, totalCols - 1, 2, totalCols);
  const metaRightCell = ws.getCell(2, totalCols - 1);
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  metaRightCell.value = `日期: ${dateStr}`;
  metaRightCell.font = { name: '微軟正黑體', size: 10, color: { argb: '00333333' } };
  metaRightCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // ── Row 3: Column headers ──
  const headerRow = ws.getRow(3);
  const headerBg = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: '001F4E79' }, // Dark navy blue
  };
  const headerFont = {
    name: '微軟正黑體',
    size: 10,
    bold: true,
    color: { argb: '00FFFFFF' },
  };
  const headerBorder = {
    top: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
    bottom: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
    left: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
    right: { style: 'thin' as const, color: { argb: '00FFFFFF' } },
  };

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = headerBg;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = headerBorder;
  });
  headerRow.height = 32;

  // ── Sort projects: extract numeric part from caseNumber, largest first ──
  const sortedProjects = [...projects].sort((a, b) => {
    const numA = extractNumber(a.caseNumber);
    const numB = extractNumber(b.caseNumber);
    return numB - numA; // Descending
  });

  // ── Data rows ──
  const dataBorder = {
    top: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    bottom: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    left: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
    right: { style: 'thin' as const, color: { argb: '00D0D0D0' } },
  };

  let currentRow = 4; // Data starts at row 4

  for (const project of sortedProjects) {
    const subs = project.subProjects || [];
    const subCount = Math.max(subs.length, 1); // At least 1 row per project
    const startRow = currentRow;
    const endRow = currentRow + subCount - 1;

    // Determine if this project is inactive (completed or on-hold)
    const isInactive = project.status === 'on-hold' ||
      project.isOnHold ||
      (subs.length > 0 && subs.every(sp => sp.latestLog?.completionPercentage === 100));

    const fontColor = isInactive ? '00999999' : '00333333'; // Gray for inactive
    const dataFont = {
      name: '微軟正黑體',
      size: 9,
      color: { argb: fontColor },
    };
    const wrapAlignment = {
      vertical: 'top' as const,
      wrapText: true,
    };

    // ── Write main project columns (A-G) — merged if multiple sub-projects ──
    const mainProjectData = [
      project.caseNumber || '',
      project.name || '',
      project.projectPurpose || '',
      project.currentStatusAndIssues || '',
      project.yiehPhuiProjectManager || '',
      project.tpmOfficeContact || '',
      project.egigaContact || '',
    ];

    // Merge cells for columns A-G if there are multiple sub-projects
    if (subCount > 1) {
      for (let col = 1; col <= 7; col++) {
        ws.mergeCells(startRow, col, endRow, col);
      }
    }

    // Write main project data into the first row of the merged range
    for (let col = 1; col <= 7; col++) {
      const cell = ws.getCell(startRow, col);
      cell.value = mainProjectData[col - 1];
      cell.font = dataFont;
      cell.alignment = { ...wrapAlignment, vertical: 'top' };
      cell.border = dataBorder;
    }

    // Apply borders to all merged rows for columns A-G
    if (subCount > 1) {
      for (let r = startRow + 1; r <= endRow; r++) {
        for (let col = 1; col <= 7; col++) {
          const cell = ws.getCell(r, col);
          cell.border = dataBorder;
        }
      }
    }

    // ── Write sub-project rows (columns H-N) ──
    if (subs.length === 0) {
      // No sub-projects — fill H-N with empty
      for (let col = 8; col <= totalCols; col++) {
        const cell = ws.getCell(startRow, col);
        cell.value = '';
        cell.font = dataFont;
        cell.alignment = wrapAlignment;
        cell.border = dataBorder;
      }
    } else {
      subs.forEach((sp, idx) => {
        const rowNum = startRow + idx;
        const spInactive = isInactive || sp.isOnHold || sp.isParentOnHold ||
          sp.latestLog?.completionPercentage === 100;
        const spFont = {
          name: '微軟正黑體',
          size: 9,
          color: { argb: spInactive ? '00999999' : '00333333' },
        };

        const subData = [
          sp.name || '',
          sp.latestLog?.executionSummary || '',
          sp.latestLog?.nextWeekPlan || '',
          sp.latestLog?.roadblocks || '',
          sp.latestLog?.completionPercentage != null ? `${sp.latestLog.completionPercentage}%` : '',
          sp.expectedCompletionDate ? formatDateForExcel(sp.expectedCompletionDate) : '',
          sp.actualCompletionDate ? formatDateForExcel(sp.actualCompletionDate) : '',
        ];

        for (let col = 8; col <= totalCols; col++) {
          const cell = ws.getCell(rowNum, col);
          cell.value = subData[col - 8];
          cell.font = spFont;
          cell.alignment = wrapAlignment;
          cell.border = dataBorder;
        }

        // Highlight roadblock cells with red font if there's an issue
        const roadblockValue = sp.latestLog?.roadblocks;
        if (roadblockValue && roadblockValue !== '無' && roadblockValue.trim() !== '') {
          const roadblockCell = ws.getCell(rowNum, 11); // Column K = 遭遇問題及風險
          roadblockCell.font = {
            ...spFont,
            color: { argb: spInactive ? '00CC9999' : '00CC0000' },
          };
        }
      });
    }

    // Set row heights — auto-ish based on content
    for (let r = startRow; r <= endRow; r++) {
      const row = ws.getRow(r);
      row.height = 60; // Default height for data rows
    }

    // Add alternating light background for readability
    if ((sortedProjects.indexOf(project) % 2) === 1) {
      for (let r = startRow; r <= endRow; r++) {
        for (let col = 1; col <= totalCols; col++) {
          const cell = ws.getCell(r, col);
          if (!cell.fill || (cell.fill as any).pattern !== 'solid') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '00F7F9FC' }, // Very light blue-gray
            };
          }
        }
      }
    }

    currentRow = endRow + 1;
  }

  // ── Generate & download ──
  const fileName = `全專案最新進度總表_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;

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
    console.error('Excel 匯出失敗:', err);
    alert('Excel 匯出失敗，請再試一次');
  }
}

/** Extract numeric portion from case number for sorting (e.g. "32" from "32") */
function extractNumber(caseNumber: string): number {
  const match = caseNumber?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatDateForExcel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}
