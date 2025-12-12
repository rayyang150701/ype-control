

'use client';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { SubProjectWithLatestLog, ProgressLog, User, FullProject } from '@/types';

// This file contains only client-side safe code.

// Common styles
const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '305496' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
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
  } 
};

// Style for on-hold projects
const onHoldStyle = {
  font: { color: { rgb: "A9A9A9" } }, // Dark Gray
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

// 1. 全專案最新進度總表
export const exportAllProjectsSummary = (subProjects: SubProjectWithLatestLog[], users: User[]) => {
  // Sort projects by caseNumber descending
  subProjects.sort((a, b) => 
    (b.projectCaseNumber ?? '').localeCompare(a.projectCaseNumber ?? '', undefined, { numeric: true })
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
    [], // Spacer
    headers
  ];

  const projectsMap = new Map<string, FullProject & { subProjects: SubProjectWithLatestLog[] }>();

  subProjects.forEach(sp => {
    if (!projectsMap.has(sp.projectId)) {
        const representativeSubProject = subProjects.find(p => p.projectId === sp.projectId && (p.projectPurpose || p.currentStatusAndIssues));
      
        projectsMap.set(sp.projectId, {
        id: sp.projectId,
        caseNumber: sp.projectCaseNumber ?? '',
        name: sp.projectName ?? '',
        projectPurpose: representativeSubProject?.projectPurpose ?? '',
        currentStatusAndIssues: representativeSubProject?.currentStatusAndIssues ?? '',
        yiehPhuiProjectManager: representativeSubProject?.yiehPhuiProjectManager ?? '',
        tpmOfficeContact: representativeSubProject?.tpmOfficeContact ?? '',
        egigaContact: representativeSubProject?.egigaContact ?? '',
        isOnHold: sp.isParentOnHold, // Use isParentOnHold from one of its children
        subProjects: [],
      } as FullProject & { subProjects: SubProjectWithLatestLog[] });
    }
    projectsMap.get(sp.projectId)?.subProjects.push(sp);
  });

  projectsMap.forEach(project => {
    project.subProjects.forEach((sp, index) => {
      const isEffectivelyOnHold = sp.isOnHold || sp.isParentOnHold;
      const isSingleSubProject = project.subProjects.length === 1;

      const expectedDate = sp.expectedCompletionDate ? format(new Date(sp.expectedCompletionDate as string), 'yyyy/MM/dd') : '';
      const actualDate = sp.actualCompletionDate ? format(new Date(sp.actualCompletionDate as string), 'yyyy/MM/dd') : '';
      const completionPercentage = `${sp.latestLog?.completionPercentage ?? 0}%`;
      
      const sharedCellStyle = (isEffectivelyOnHold && isSingleSubProject) ? onHoldStyle : defaultCellStyle;
      const subProjectCellStyle = isEffectivelyOnHold ? onHoldStyle : defaultCellStyle;

      const row = index === 0 
        ? [
            { v: project.caseNumber, s: sharedCellStyle },
            { v: project.name, s: sharedCellStyle },
            { v: project.projectPurpose || '尚未填寫', s: sharedCellStyle },
            { v: project.currentStatusAndIssues || '尚未填寫', s: sharedCellStyle },
            { v: project.yiehPhuiProjectManager || '尚未填寫', s: sharedCellStyle },
            { v: project.tpmOfficeContact || '尚未填寫', s: sharedCellStyle },
            { v: project.egigaContact || '尚未填寫', s: sharedCellStyle },
            { v: sp.name, s: subProjectCellStyle },
            { v: sp.latestLog?.executionSummary ?? '無紀錄', s: subProjectCellStyle },
            { v: sp.latestLog?.nextWeekPlan ?? '無紀錄', s: subProjectCellStyle },
            { v: sp.latestLog?.roadblocks || '無', s: subProjectCellStyle },
            { v: completionPercentage, s: subProjectCellStyle },
            { v: expectedDate, s: subProjectCellStyle },
            { v: actualDate, s: subProjectCellStyle }
          ]
        : [
            '', '', '', '', '', '', '', // Empty cells for merged rows
            { v: sp.name, s: subProjectCellStyle },
            { v: sp.latestLog?.executionSummary ?? '無紀錄', s: subProjectCellStyle },
            { v: sp.latestLog?.nextWeekPlan ?? '無紀錄', s: subProjectCellStyle },
            { v: sp.latestLog?.roadblocks || '無', s: subProjectCellStyle },
            { v: completionPercentage, s: subProjectCellStyle },
            { v: expectedDate, s: subProjectCellStyle },
            { v: actualDate, s: subProjectCellStyle }
          ];
      data.push(row);
    });
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length -1 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Dept
    { s: { r: 1, c: 6 }, e: { r: 1, c: headers.length - 1 } }, // Date
  ];

  let currentRow = 4; // Start after headers (index-based)
  projectsMap.forEach(project => {
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
      { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 40 }, 
      { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
    ],
    merges
  );
  
  // Style Title
  if (ws['A1']) ws['A1'].s = titleStyle;
  
  // Style Headers
  const headerRowIndex = 3;
  for (let C = 0; C < headers.length; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
    if (ws[cellRef]) ws[cellRef].s = headerStyle;
  }
  
  exportToExcel([{ ws, name: '全專案總表' }], '全專案最新進度總表');
};

// 3. 單一子專案歷史週報表
export const exportSubProjectHistory = (subProject: SubProjectWithLatestLog, logs: ProgressLog[], users: User[]) => {
    const title = `${subProject.projectCaseNumber} ${subProject.projectName} - ${subProject.name} 歷史週報`;
    const headers = ['提報區間', '本週摘要', '下週計畫', '問題', '進度%', '更新時間', '填寫人'];
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const data = [
        [title],
        [`製表單位: TPM管理室`, '', '', '', `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
        [],
        headers
    ];

    logs.forEach(log => {
        data.push([
            log.reportingPeriod,
            log.executionSummary,
            log.nextWeekPlan,
            log.roadblocks || '無',
            log.completionPercentage,
            format(new Date(log.updatedAt as string), 'yyyy/MM/dd HH:mm'),
            userMap.get(log.createdBy) ?? ''
        ]);
    });

    const ws = createSheetFromAOA(
        data,
        title,
        [{ wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 15 }],
        [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
        ]
    );

    // Style Title
    if (ws['A1']) ws['A1'].s = titleStyle;

    // Style Headers
    const headerRowIndex = 3;
    for (let C = 0; C < headers.length; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }
    
    // Default style for data rows
    for (let R = headerRowIndex + 1; R < data.length; ++R) {
        for (let C = 0; C < headers.length; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) ws[cellRef].s = defaultCellStyle;
        }
    }


    exportToExcel([{ ws, name: '子專案歷史' }], `${subProject.name}_歷史週報`);
};

    
