'use client';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { format, differenceInDays } from 'date-fns';
import { SubProjectWithLatestLog, ProgressLog, User } from '@/types';

// This file contains only client-side safe code.

// Common styles
const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '305496' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const titleStyle = {
  font: { sz: 16, bold: true },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const centerAlign = { alignment: { horizontal: 'center', vertical: 'center' } };
const wrapText = { alignment: { wrapText: true, vertical: 'top' } };

const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF--8';
const fileExtension = '.xlsx';

const createSheet = (data: any[][], title: string, colWidths: { wch: number }[], merges: XLSX.Range[]) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  // Apply styles
  // Title
  if (ws['A1']) ws['A1'].s = titleStyle;
  
  // Headers
  const headerRow = data.findIndex(row => row.length > 1 && row[0] !== title && !String(row[0]).startsWith("製表"));
  if (headerRow !== -1) {
    for (let i = 0; i < data[headerRow].length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: i });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }
  }

  // Data cells - basic styling
  for(let R = headerRow + 1; R < data.length; ++R) {
    for(let C = 0; C < data[R].length; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if(!ws[cellRef]) continue;
      ws[cellRef].s = { ...wrapText };
      // Center specific columns based on new layout
      if ([0, 1, 10, 11, 12].includes(C)) {
        ws[cellRef].s = { ...ws[cellRef].s, ...centerAlign };
      }
    }
  }

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
    [`製表單位: 資訊部`, null, null, null, `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
    [], // Spacer
    headers
  ];

  // Create a map to group subprojects by project ID
  const projectsMap = new Map<string, any>();

  subProjects.forEach(sp => {
    if (!projectsMap.has(sp.projectId)) {
        const sourceProjectData = subProjects.find(p => p.projectId === sp.projectId);
        projectsMap.set(sp.projectId, {
            caseNumber: sourceProjectData?.projectCaseNumber,
            projectName: sourceProjectData?.projectName,
            projectPurpose: sourceProjectData?.projectPurpose,
            currentStatusAndIssues: sourceProjectData?.currentStatusAndIssues,
            yiehPhuiProjectManager: sourceProjectData?.yiehPhuiProjectManager,
            tpmOfficeContact: sourceProjectData?.tpmOfficeContact,
            egigaContact: sourceProjectData?.egigaContact,
            subProjects: []
        });
    }
    projectsMap.get(sp.projectId).subProjects.push(sp);
  });


  projectsMap.forEach(project => {
    project.subProjects.forEach((sp: SubProjectWithLatestLog, index: number) => {
      const expectedDate = sp.expectedCompletionDate ? format(new Date(sp.expectedCompletionDate as string), 'yyyy/MM/dd') : '';
      const actualDate = sp.actualCompletionDate ? format(new Date(sp.actualCompletionDate as string), 'yyyy/MM/dd') : '';
      const completionPercentage = sp.latestLog?.completionPercentage ?? 0;
      
      const row = index === 0 
        ? [
            project.caseNumber ?? '',
            project.projectName ?? '',
            project.projectPurpose ?? '',
            project.currentStatusAndIssues ?? '',
            project.yiehPhuiProjectManager ?? '',
            project.tpmOfficeContact ?? '',
            project.egigaContact ?? '',
            sp.name,
            sp.latestLog?.executionSummary ?? '無紀錄',
            sp.latestLog?.nextWeekPlan ?? '無紀錄',
            sp.latestLog?.roadblocks || '無',
            completionPercentage,
            expectedDate,
            actualDate
          ]
        : [
            '', '', '', '', '', '', '', // Empty cells for merged rows
            sp.name,
            sp.latestLog?.executionSummary ?? '無紀錄',
            sp.latestLog?.nextWeekPlan ?? '無紀錄',
            sp.latestLog?.roadblocks || '無',
            completionPercentage,
            expectedDate,
            actualDate
          ];
      data.push(row);
    })
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length -1 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Dept
    { s: { r: 1, c: 4 }, e: { r: 1, c: headers.length -1 } }, // Date
  ];

  let currentRow = 4; // Start after headers
  projectsMap.forEach(project => {
    const subProjectCount = project.subProjects.length;
    if (subProjectCount > 1) {
      for(let i=0; i < 7; i++){
         merges.push({ s: { r: currentRow, c: i }, e: { r: currentRow + subProjectCount - 1, c: i } });
      }
    }
    currentRow += subProjectCount;
  });


  const ws = createSheet(
    data,
    title,
    [
      { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, 
      { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 40 }, 
      { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
    ],
    merges
  );
  
  exportToExcel([{ ws, name: '全專案總表' }], '全專案最新進度總表');
};

// 3. 單一子專案歷史週報表
export const exportSubProjectHistory = (subProject: SubProjectWithLatestLog, logs: ProgressLog[], users: User[]) => {
    const title = `${subProject.projectCaseNumber} ${subProject.projectName} - ${subProject.name} 歷史週報`;
    const headers = ['提報區間', '本週摘要', '下週計畫', '問題', '進度%', '更新時間', '填寫人'];
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const data = [
        [title],
        [`製表單位: 資訊部`, null, null, `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
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

    const ws = createSheet(
        data,
        title,
        [{ wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 15 }],
        [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
            { s: { r: 1, c: 3 }, e: { r: 1, c: 6 } },
        ]
    );

    exportToExcel([{ ws, name: '子專案歷史' }], `${subProject.name}_歷史週報`);
};
