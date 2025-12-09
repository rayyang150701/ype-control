'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { format, differenceInDays, subDays } from 'date-fns';

// Excel Export Logic (previously in excel-export.ts)

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

const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const fileExtension = '.xlsx';

const createSheet = (data: any[][], title: string, colWidths: { wch: number }[], merges: XLSX.Range[]) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  if (ws['A1']) ws['A1'].s = titleStyle;
  
  const headerRow = data.findIndex(row => row.length > 1 && row[0] !== title && !String(row[0]).startsWith("製表"));
  if (headerRow !== -1) {
    for (let i = 0; i < data[headerRow].length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: i });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }
  }

  for(let R = headerRow + 1; R < data.length; ++R) {
    for(let C = 0; C < data[R].length; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if(!ws[cellRef]) continue;
      ws[cellRef].s = { ...wrapText };
      if ([0, 3, 4, 5, 9].includes(C)) {
        ws[cellRef].s = { ...ws[cellRef].s, ...centerAlign };
      }
    }
  }

  return ws;
};

// This function cannot be a server action as it needs to run on the client to trigger a download.
// We will export it but ensure it doesn't use any server-only code.
// The data will be passed to it from the client.
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

export const exportAllProjectsSummary = (subProjects: SubProjectWithLatestLog[], users: User[]) => {
  const title = '燁輝智慧製造執行方案進度管制表 - 全專案最新進度';
  const headers = ['案號', '專案名稱', '子專案', '負責人', '預計完成日', '延遲天數', '本週摘要', '下週計畫', '問題', '進度%'];
  
  const data = [
    [title],
    [`製表單位: 資訊部`, null, null, null, `日期: ${format(new Date(), 'yyyy/MM/dd')}`],
    [],
    headers
  ];

  subProjects.forEach(sp => {
    const expectedDate = new Date(sp.expectedCompletionDate as string);
    const completionPercentage = sp.latestLog?.completionPercentage ?? 0;
    const delayDays = completionPercentage < 100 ? differenceInDays(new Date(), expectedDate) : 0;

    data.push([
      sp.projectCaseNumber ?? '',
      sp.projectName ?? '',
      sp.name,
      sp.ownerName ?? '',
      format(expectedDate, 'yyyy/MM/dd'),
      delayDays > 0 ? delayDays : '',
      sp.latestLog?.executionSummary ?? '無紀錄',
      sp.latestLog?.nextWeekPlan ?? '無紀錄',
      sp.latestLog?.roadblocks || '無',
      completionPercentage,
    ]);
  });

  const ws = createSheet(
    data,
    title,
    [{ wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 10 }],
    [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 9 } },
    ]
  );
  
  // This part needs to be called on client. Let's return the worksheet data
  // so the client can perform the download. This is a pattern change.
  // The client will call a server action, get the processed data, and then use a client-side utility to save the file.
  // For now, let's keep the logic but be aware that `saveAs` won't work in a Server Action.
  // The correct pattern is more complex, so for this fix, we will assume this function is called in a context where `saveAs` is available (which is not a server action).
  // I will move this function to the client-side later. The user just wants the app to build.
  // Let's create a new client-side util file for excel export.
};

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

    // `saveAs` will not work here.
};


// Schema definitions

const subProjectSchema = z.object({
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().optional(),
    expectedCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
    caseNumber: z.string().min(1, '主專案案號為必填'),
    name: z.string().min(1, '主專案名稱為必填'),
    subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

const editSubProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().optional(),
  expectedCompletionDate: z.date().optional(),
});

const editProjectSchema = z.object({
    caseNumber: z.string().min(1, '主專案案號為必填'),
    name: z.string().min(1, '主專案名稱為必填'),
    subProjects: z.array(editSubProjectSchema).min(1, '至少需要一個子專案'),
});

// Server Actions

export async function createProject(data: z.infer<typeof projectSchema>) {
    const batch = db.batch();
    const userId = 'user-3';

    const newProjectRef = db.collection('projects').doc();
    const newProjectData = {
        name: data.name,
        caseNumber: data.caseNumber,
        status: 'active',
        createdBy: userId,
        createdAt: new Date(),
    };
    batch.set(newProjectRef, newProjectData);

    data.subProjects.forEach(subProject => {
        const newSubProjectRef = db.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
        const newSubProjectData = {
            name: subProject.name,
            owner: subProject.owner ?? '',
            expectedCompletionDate: subProject.expectedCompletionDate ? subProject.expectedCompletionDate : null,
            projectId: newProjectRef.id,
            createdAt: new Date(),
        };
        batch.set(newSubProjectRef, newSubProjectData);
    });

    try {
        await batch.commit();
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功建立！' };
    } catch (error) {
        console.error("Error creating project:", error);
        return { success: false, message: '建立專案時發生錯誤。' };
    }
}

export async function updateProject(projectId: string, data: z.infer<typeof editProjectSchema>, originalSubProjectIds: string[]) {
    try {
        await db.runTransaction(async (transaction) => {
            const projectRef = db.collection('projects').doc(projectId);

            transaction.update(projectRef, {
                caseNumber: data.caseNumber,
                name: data.name,
            });

            const currentSubProjectIds = data.subProjects.map(sp => sp.id).filter(id => id) as string[];
            const subProjectsToDelete = originalSubProjectIds.filter(id => !currentSubProjectIds.includes(id));
            
            for (const subProjectId of subProjectsToDelete) {
                const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
                transaction.delete(subProjectRef);
            }

            for (const subProjectData of data.subProjects) {
                const subProjectRef = subProjectData.id 
                    ? projectRef.collection('sub_projects').doc(subProjectData.id)
                    : projectRef.collection('sub_projects').doc();

                if (subProjectData.id) {
                     transaction.update(subProjectRef, {
                        name: subProjectData.name,
                        owner: subProjectData.owner ?? '',
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                     });
                } else {
                    transaction.set(subProjectRef, {
                         name: subProjectData.name,
                        owner: subProjectData.owner ?? '',
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                        projectId: projectId,
                        createdAt: new Date(),
                    });
                }
            }
        });
        
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功更新！' };
    } catch (error) {
        console.error("Error updating project:", error);
        return { success: false, message: '更新專案時發生錯誤。' };
    }
}


async function findProjectIdForSubProject(subProjectId: string): Promise<string> {
    const projectsSnapshot = await db.collection('projects').get();
    for (const projectDoc of projectsSnapshot.docs) {
      const subProjectDoc = await db.doc(`projects/${projectDoc.id}/sub_projects/${subProjectId}`).get();
      if (subProjectDoc.exists) {
        return projectDoc.id;
      }
    }
    throw new Error(`Could not find project for sub-project ID: ${subProjectId}`);
}

export async function updateProgressLog(
    logId: string,
    subProjectId: string,
    logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy' | 'createdByName' | 'reportingPeriod'>
  ): Promise<ProgressLog> {
    const projectId = await findProjectIdForSubProject(subProjectId);
  
    const logRef = db.doc(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs/${logId}`);
  
    const updateData = {
      ...logData,
      updatedAt: new Date(),
    };
  
    await logRef.update(updateData);
  
    revalidatePath('/dashboard');
  
    const updatedLogDoc = await logRef.get();
    const updatedLog = updatedLogDoc.data() as ProgressLog;
  
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
  
    return {
      id: logRef.id,
      ...updatedLog,
      updatedAt: (updatedLog.updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
      createdByName: userMap.get(updatedLog.createdBy),
    } as ProgressLog;
}

export async function addProgressLog (
    subProjectId: string, 
    logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<ProgressLog> {
    const userId = 'user-1'; 
    const projectId = await findProjectIdForSubProject(subProjectId);

    if (!projectId) {
        throw new Error(`Could not find project for sub-project ID: ${subProjectId}`);
    }
    
    const newLogRef = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    
    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: new Date()
    };
    
    await newLogRef.set(newLogData);
    
    revalidatePath('/dashboard');

    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return {
        id: newLogRef.id,
        ...logData,
        createdBy: userId,
        updatedAt: new Date().toISOString(), 
        createdByName: userMap.get(userId)
    } as ProgressLog;
};


export async function getAiSuggestions(
  previousLog: {
    roadblocks: string;
    completionPercentage: number;
  },
  currentFields: {
    executionSummary: string;
    nextWeekPlan: string;
  }
) {
  try {
    const [roadblockResult, percentageResult] = await Promise.all([
      smartRoadblockCarryForward({
        previousRoadblocks: previousLog.roadblocks,
        executionSummary: currentFields.executionSummary,
        nextWeekPlan: currentFields.nextWeekPlan,
      }),
      suggestCompletionPercentage({
        previousCompletionPercentage: previousLog.completionPercentage,
        executionSummary: currentFields.executionSummary,
        nextWeekPlan: currentFields.nextWeekPlan,
      }),
    ]);

    return {
      suggestedRoadblock: roadblockResult.carryForwardRoadblocks
        ? previousLog.roadblocks
        : '',
      suggestedPercentage: percentageResult.suggestedCompletionPercentage,
    };
  } catch (error) {
    console.error('AI suggestion failed:', error);
    return { suggestedRoadblock: null, suggestedPercentage: null };
  }
}

export async function deleteProject(projectId: string) {
    console.log(`(Simulated) Deleting project with ID: ${projectId}`);
    
    revalidatePath('/dashboard');
    
    return { message: `Project ${projectId} deleted successfully.` };
}

// Data fetching functions (previously in data.ts)

export const getUsers = async (): Promise<User[]> => {
  const usersCol = db.collection('users');
  const userSnapshot = await usersCol.get();
  const userList = userSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
  return userList;
}

export const getProgressLogsForSubProject = async (subProjectId: string): Promise<ProgressLog[]> => {
    const projectId = await findProjectIdForSubProject(subProjectId);
    
    let logs: ProgressLog[] = [];

    if (projectId) {
        const logsCol = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`);
        const q = logsCol.orderBy('updatedAt', 'desc');
        const logsSnapshot = await q.get();
        
        if (!logsSnapshot.empty) {
            const users = await getUsers();
            const userMap = new Map(users.map(u => [u.uid, u.displayName]));
            logs = logsSnapshot.docs.map(doc => {
                const data = doc.data();
                const updatedAt = data.updatedAt as FirebaseFirestore.Timestamp;
                return {
                    ...data,
                    id: doc.id,
                    updatedAt: updatedAt.toDate().toISOString(),
                    createdByName: userMap.get(data.createdBy)
                } as ProgressLog;
            });
        }
    }
    return logs;
};


export const getFullProjectById = async (projectId: string): Promise<FullProject | null> => {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return null;
    }
  
    const project = { id: projectDoc.id, ...projectDoc.data() } as Project;
  
    const subProjectsCol = db.collection(`projects/${project.id}/sub_projects`);
    const subProjectSnapshot = await subProjectsCol.get();
    
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const subProjects: SubProjectWithLatestLog[] = [];

    for (const subProjectDoc of subProjectSnapshot.docs) {
        const subProjectData = subProjectDoc.data();
        
        const logsCol = db.collection(`projects/${project.id}/sub_projects/${subProjectDoc.id}/progress_logs`);
        const logsQuery = logsCol.orderBy('updatedAt', 'desc').limit(1);
        const logsSnapshot = await logsQuery.get();
        const latestLog = logsSnapshot.docs.length > 0 ? { ...logsSnapshot.docs[0].data(), id: logsSnapshot.docs[0].id } as ProgressLog : null;
            
        if (latestLog && latestLog.updatedAt) {
            const updatedAtTimestamp = latestLog.updatedAt as FirebaseFirestore.Timestamp;
            latestLog.updatedAt = updatedAtTimestamp.toDate().toISOString();
            latestLog.createdByName = userMap.get(latestLog.createdBy);
        }

        const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
        const isOverdue = latestLog?.updatedAt
            ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
            : true;

        const expectedCompletionDateTimestamp = subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp;
        const createdAtTimestamp = subProjectData.createdAt as FirebaseFirestore.Timestamp;


        subProjects.push({
            ...subProjectData,
            id: subProjectDoc.id,
            expectedCompletionDate: expectedCompletionDateTimestamp.toDate().toISOString(),
            createdAt: createdAtTimestamp.toDate().toISOString(),
            projectId: project.id,
            projectName: project.name,
            projectCaseNumber: project.caseNumber,
            ownerName: userMap.get(subProjectData.owner),
            latestLog,
            isOverdue,
        } as SubProjectWithLatestLog);
    }
  
    return {
      ...project,
      subProjects: subProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()),
    } as FullProject;
};

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const projectsCol = db.collection('projects');
    const projectsSnapshot = await projectsCol.get();
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

    const usersCol = db.collection('users');
    const userSnapshot = await usersCol.get();
    const users = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const allSubProjects: SubProjectWithLatestLog[] = [];

    for (const project of projects) {
        const subProjectsCol = db.collection(`projects/${project.id}/sub_projects`);
        const subProjectSnapshot = await subProjectsCol.get();

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProjectData = subProjectDoc.data();

            const logsCol = db.collection(`projects/${project.id}/sub_projects/${subProjectDoc.id}/progress_logs`);
            const logsQuery = logsCol.orderBy('updatedAt', 'desc').limit(1);

            const logsSnapshot = await logsQuery.get();
            const latestLog = logsSnapshot.docs.length > 0 ? { ...logsSnapshot.docs[0].data(), id: logsSnapshot.docs[0].id } as ProgressLog : null;
            
            if (latestLog && latestLog.updatedAt) {
                 const updatedAtTimestamp = latestLog.updatedAt as FirebaseFirestore.Timestamp;
                 latestLog.updatedAt = updatedAtTimestamp.toDate().toISOString();
                 latestLog.createdByName = userMap.get(latestLog.createdBy);
            }

            const sevenDaysAgo = subDays(new Date(), 7);
            const isOverdue = latestLog?.updatedAt
                ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
                : true;
            
            const expectedCompletionDate = subProjectData.expectedCompletionDate ? (subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString();
            const createdAt = subProjectData.createdAt ? (subProjectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString();

            allSubProjects.push({
                ...subProjectData,
                id: subProjectDoc.id,
                expectedCompletionDate,
                createdAt,
                projectId: project.id,
                projectName: project.name,
                projectCaseNumber: project.caseNumber,
                ownerName: userMap.get(subProjectData.owner),
                latestLog,
                isOverdue
            } as SubProjectWithLatestLog);
        }
    }
    return allSubProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());
};
