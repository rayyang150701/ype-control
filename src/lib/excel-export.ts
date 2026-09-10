'use client';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { SubProjectWithLatestLog, ProgressLog, User, FullProject } from '@/types';

// Common styles
const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '305496' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  }
};
const titleStyle = {
  font: { sz: 16, bold: true },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const defaultCellStyle = {
  alignment: { 
    wrapText: true, 
    vertical: 'center', 
    horizontal: 'left' 
  },
  border: {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  }
};

const onHoldStyle = {
  font: { color: { rgb: "A9A9A9" } }, // Dark Gray
  ...defaultCellStyle
};

// 依手冊規範：已 100% 結案之項目套用綠色底圖
const completedStyle = {
  fill: { fgColor: { rgb: "E2EFDA" } }, // Light green background
  font: { color: { rgb: "276A3C" }, bold: true },
  ...defaultCellStyle
};

const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF--8';
const fileExtension = '.xlsx';

const createSheetFromAOA = (data: any[][], title: string, colWidths: { wch: number }[], merges: XLSX.Range[]) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;
  return ws;
};

const exportToExcel = (sheets: { ws: XLSX.WorkSheet; name: string }[], fileName: string) => {
  const wb: XLSX.WorkBook = { Sheets: {}, SheetNames: [] };
  sheets.forEach(sheet => {
    wb.Sheets[sheet.name] = sheet.ws;
    wb.SheetNames.push(sheet.name);
  });
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: fileType });
  saveAs(data, fileName + fileExtension);
};

export const exportAllProjectsSummary = (projects: FullProject[], users: User[]) => {
  // 1. 強力過濾與排序：案號從大到小 (例如 37, 36, 35...)
  const sortedProjects = [...projects]
    .filter(p => p.subProjects && p.subProjects.length > 0)
    .sort((a, b) => 
      (b.caseNumber ?? '').localeCompare(a.caseNumber ?? '', undefined, { numeric: true })
    );

  const title = '燁輝智慧製造執行方案進度管制表 - 全專案最新進度';
  const headers = [
    '主專案案號', 
    '主專案名稱', 
    '專案目的', 
    '現況/問題點', 
    '燁輝專案負責主管與分機', 
    'TPM管理室窗口', 
    '億威電子', 
    '子專案名稱', 
    '本週執行摘要', 
    '下週工作計畫', 
    '遭遇問題及風險', 
    '總體完成度', 
    '預計完成日', 
    '實際完成日'
  ];
  
  const data: any[][] = [
    [title],
    [`製表單位: TPM管理室`, '', '', '', '', '', `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
    [], 
    headers
  ];

  sortedProjects.forEach(project => {
    project.subProjects.forEach((sp, index) => {
      const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
      const expectedDate = sp.expectedCompletionDate ? format(new Date(sp.expectedCompletionDate as string), 'yyyy/MM/dd') : '';
      const actualDate = sp.actualCompletionDate ? format(new Date(sp.actualCompletionDate as string), 'yyyy/MM/dd') : '';
      const completionPercentage = `${sp.latestLog?.completionPercentage ?? 0}%`;
      const isCompleted = (sp.latestLog?.completionPercentage ?? 0) === 100;
      
      // 依手冊規範：已結案套用綠底，暫緩套用灰字
      let currentStyle = defaultCellStyle;
      if (isEffectivelyOnHold) {
        currentStyle = onHoldStyle;
      } else if (isCompleted) {
        currentStyle = completedStyle;
      }

      const row = [
        { v: project.caseNumber, s: currentStyle },
        { v: project.name, s: currentStyle },
        { v: project.projectPurpose || '尚未填寫', s: currentStyle },
        { v: project.currentStatusAndIssues || '尚未填寫', s: currentStyle },
        { v: project.yiehPhuiProjectManager || '尚未填寫', s: currentStyle },
        { v: project.tpmOfficeContact || '尚未填寫', s: currentStyle },
        { v: project.egigaContact || '尚未填寫', s: currentStyle },
        { v: sp.name, s: currentStyle },
        { v: sp.latestLog?.executionSummary ?? '', s: currentStyle },
        { v: sp.latestLog?.nextWeekPlan ?? '', s: currentStyle },
        { v: sp.latestLog?.roadblocks || '', s: currentStyle },
        { v: completionPercentage, s: currentStyle },
        { v: expectedDate, s: currentStyle },
        { v: actualDate, s: currentStyle }
      ];
      data.push(row);
    });
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, 
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, 
    { s: { r: 1, c: 6 }, e: { r: 1, c: headers.length - 1 } }, 
  ];

  let currentRow = 4; 
  sortedProjects.forEach(project => {
    const subProjectCount = project.subProjects.length;
    if (subProjectCount > 1) {
      for(let i=0; i < 7; i++){
         merges.push({ s: { r: currentRow, c: i }, e: { r: currentRow + subProjectCount - 1, c: i } });
      }
    }
    currentRow += subProjectCount;
  });

  const ws = createSheetFromAOA(
    data,
    title,
    [
      { wch: 10 }, { wch: 25 }, { wch: 35 }, { wch: 35 }, { wch: 25 }, 
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 45 }, { wch: 45 }, 
      { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
    ],
    merges
  );
  
  if (ws['A1']) ws['A1'].s = titleStyle;
  
  const headerRowIndex = 3;
  for (let C = 0; C < headers.length; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
    if (ws[cellRef]) ws[cellRef].s = headerStyle;
  }
  
  exportToExcel([{ ws, name: '全專案總表' }], '全專案最新進度總表');
};

export const exportSubProjectHistory = (subProject: SubProjectWithLatestLog, logs: ProgressLog[], users: User[]) => {
    const title = `${subProject.projectCaseNumber} ${subProject.projectName} - ${subProject.name} 歷史週報`;
    const headers = ['提報區間', '本週摘要', '下週計畫', '問題', '進度%', '更新時間', '填寫人'];
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const data: any[][] = [
        [title],
        [`製表單位: TPM管理室`, '', '', '', `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
        [],
        headers
    ];

    logs.forEach(log => {
        data.push([
            { v: log.reportingPeriod, s: defaultCellStyle },
            { v: log.executionSummary, s: defaultCellStyle },
            { v: log.nextWeekPlan, s: defaultCellStyle },
            { v: log.roadblocks || '無', s: defaultCellStyle },
            { v: log.completionPercentage, s: defaultCellStyle },
            { v: format(new Date(log.updatedAt as string), 'yyyy/MM/dd HH:mm'), s: defaultCellStyle },
            { v: userMap.get(log.createdBy) ?? '', s: defaultCellStyle }
        ]);
    });

    const ws = createSheetFromAOA(
        data,
        title,
        [{ wch: 20 }, { wch: 45 }, { wch: 45 }, { wch: 35 }, { wch: 10 }, { wch: 22 }, { wch: 15 }],
        [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
        ]
    );

    if (ws['A1']) ws['A1'].s = titleStyle;

    const headerRowIndex = 3;
    for (let C = 0; C < headers.length; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }
    
    exportToExcel([{ ws, name: '子專案歷史' }], `${subProject.name}_歷史週報`);
};
