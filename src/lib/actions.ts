'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog, SubProject } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays } from 'date-fns';

// 輔助函式：確保日期格式可以安全地序列化傳遞給客戶端
const formatFirestoreDate = (date: any): string => {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toISOString();
    }
    if (date instanceof Date) {
        return date.toISOString();
    }
    return new Date().toISOString();
};

const formatFirestoreDateOptional = (date: any): string | undefined => {
    if (!date) return undefined;
    if (typeof date === 'string') return date;
    if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toISOString();
    }
    if (date instanceof Date) {
        return date.toISOString();
    }
    return undefined;
};

// Schema definitions
const subProjectSchema = z.object({
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().min(1, '必須選擇一位負責人'),
    expectedCompletionDate: z.date().optional(),
    actualCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  projectPurpose: z.string().optional(),
  currentStatusAndIssues: z.string().optional(),
  yiehPhuiProjectManager: z.string().optional(),
  tpmOfficeContact: z.string().optional(),
  egigaContact: z.string().optional(),
  subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

const editSubProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().min(1, '必須選擇一位負責人'),
  expectedCompletionDate: z.date().optional(),
  actualCompletionDate: z.date().optional(),
});

const editProjectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  projectPurpose: z.string().optional(),
  currentStatusAndIssues: z.string().optional(),
  yiehPhuiProjectManager: z.string().optional(),
  tpmOfficeContact: z.string().optional(),
  egigaContact: z.string().optional(),
  subProjects: z.array(editSubProjectSchema).min(1, '至少需要一個子專案'),
});

const userSchema = z.object({
  displayName: z.string().min(1, '姓名為必填'),
  email: z.string().email('請輸入有效的 Email'),
  role: z.enum(['admin', 'editor', 'viewer']),
  status: z.enum(['active', 'pending']),
});

// User Management Actions
export async function createUser(data: z.infer<typeof userSchema>) {
  try {
    const newUserRef = db.collection('users').doc();
    await newUserRef.set({
      uid: newUserRef.id,
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      status: data.status,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/users');
    return { success: true, message: '成員已成功建立！' };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: '建立成員時發生錯誤。' };
  }
}

export async function updateUser(uid: string, data: z.infer<typeof userSchema>) {
  try {
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      status: data.status,
    });
    revalidatePath('/users');
    return { success: true, message: '成員已成功更新！' };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, message: '更新成員時發生錯誤。' };
  }
}

export async function deleteUser(uid: string) {
    try {
        const userRef = db.collection('users').doc(uid);
        await userRef.delete();
        revalidatePath('/users');
        return { success: true, message: '成員已成功刪除！' };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false, message: '刪除成員時發生錯誤。' };
    }
}


// Project and Progress Log Actions
export async function createProject(data: z.infer<typeof projectSchema>) {
    const batch = db.batch();
    const userId = 'user-3'; // Placeholder

    const newProjectRef = db.collection('projects').doc();
    const newProjectData = {
        name: data.name,
        caseNumber: data.caseNumber,
        status: 'active',
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
        projectPurpose: data.projectPurpose ?? '',
        currentStatusAndIssues: data.currentStatusAndIssues ?? '',
        yiehPhuiProjectManager: data.yiehPhuiProjectManager ?? '',
        tpmOfficeContact: data.tpmOfficeContact ?? '',
        egigaContact: data.egigaContact ?? '',
        isOnHold: false,
    };
    batch.set(newProjectRef, newProjectData);

    data.subProjects.forEach(subProject => {
        const newSubProjectRef = db.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
        const newSubProjectData = {
            name: subProject.name,
            owner: subProject.owner,
            expectedCompletionDate: subProject.expectedCompletionDate ?? null,
            actualCompletionDate: subProject.actualCompletionDate ?? null,
            projectId: newProjectRef.id,
            createdAt: FieldValue.serverTimestamp(),
            isOnHold: false,
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
                projectPurpose: data.projectPurpose ?? '',
                currentStatusAndIssues: data.currentStatusAndIssues ?? '',
                yiehPhuiProjectManager: data.yiehPhuiProjectManager ?? '',
                tpmOfficeContact: data.tpmOfficeContact ?? '',
                egigaContact: data.egigaContact ?? '',
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
                        owner: subProjectData.owner,
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                        actualCompletionDate: subProjectData.actualCompletionDate ?? null,
                     });
                } else {
                    transaction.set(subProjectRef, {
                        name: subProjectData.name,
                        owner: subProjectData.owner,
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                        actualCompletionDate: subProjectData.actualCompletionDate ?? null,
                        projectId: projectId,
                        createdAt: FieldValue.serverTimestamp(),
                        isOnHold: false,
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

export async function updateProgressLog(
    logId: string,
    projectId: string,
    subProjectId: string,
    logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy' | 'createdByName' | 'reportingPeriod'>
  ): Promise<ProgressLog> {
    
    if (!projectId) {
        throw new Error(`Project ID missing for sub-project: ${subProjectId}`);
    }
  
    const logRef = db.doc(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs/${logId}`);
  
    await logRef.update({
      executionSummary: logData.executionSummary,
      nextWeekPlan: logData.nextWeekPlan,
      roadblocks: logData.roadblocks,
      completionPercentage: logData.completionPercentage,
      updatedAt: FieldValue.serverTimestamp(),
    });
  
    revalidatePath('/dashboard');
    const updatedLogDoc = await logRef.get();
    const data = updatedLogDoc.data()!;
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return {
      id: logRef.id,
      subProjectId: data.subProjectId,
      reportingPeriod: data.reportingPeriod,
      executionSummary: data.executionSummary,
      nextWeekPlan: data.nextWeekPlan,
      roadblocks: data.roadblocks,
      completionPercentage: data.completionPercentage,
      createdBy: data.createdBy,
      updatedAt: formatFirestoreDate(data.updatedAt),
      createdByName: userMap.get(data.createdBy),
    } as ProgressLog;
}

export async function addProgressLog (
    projectId: string,
    subProjectId: string, 
    logData: Omit<ProgressLog, 'id' | 'subProjectId' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<ProgressLog> {
    const userId = 'user-1'; // Placeholder

    const newLogRef = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    await newLogRef.set({
        reportingPeriod: logData.reportingPeriod,
        executionSummary: logData.executionSummary,
        nextWeekPlan: logData.nextWeekPlan,
        roadblocks: logData.roadblocks,
        completionPercentage: logData.completionPercentage,
        subProjectId,
        createdBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
    });
    
    revalidatePath('/dashboard');
    return {
        id: newLogRef.id,
        subProjectId,
        reportingPeriod: logData.reportingPeriod,
        executionSummary: logData.executionSummary,
        nextWeekPlan: logData.nextWeekPlan,
        roadblocks: logData.roadblocks,
        completionPercentage: logData.completionPercentage,
        createdBy: userId,
        updatedAt: new Date().toISOString(), 
    } as ProgressLog;
};

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    const projectRef = db.collection('projects').doc(projectId);
    await db.runTransaction(async (transaction) => {
        for (const subProjectId of subProjectIds) {
            const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
            const logs = await subProjectRef.collection('progress_logs').get();
            logs.docs.forEach(log => transaction.delete(log.ref));
            transaction.delete(subProjectRef);
        }
    });
    revalidatePath('/dashboard');
}

export async function setProjectOnHold(
  projectId: string,
  subProjectIds: string[],
  onHoldData: {
    reason: string;
    startDate: Date;
    endDate?: Date;
    notes?: string;
  }
) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    const subProjectsCol = projectRef.collection('sub_projects');
    const subProjectsSnapshot = await subProjectsCol.get();

    const allSubProjectIdsInProject = subProjectsSnapshot.docs.map(doc => doc.id);
    const isAllSelected = subProjectIds.length === allSubProjectIdsInProject.length && allSubProjectIdsInProject.every(id => subProjectIds.includes(id));
    
    const onHoldPayload = {
        isOnHold: true,
        onHoldReason: onHoldData.reason,
        onHoldStartDate: onHoldData.startDate,
        onHoldEndDate: onHoldData.endDate ?? null,
        onHoldNotes: onHoldData.notes ?? '',
    };

    if (isAllSelected) {
      await projectRef.update({ ...onHoldPayload, status: 'on-hold' });
    }

    const batch = db.batch();
    subProjectIds.forEach(id => {
      batch.update(subProjectsCol.doc(id), onHoldPayload);
    });
    await batch.commit();
    
    revalidatePath('/dashboard');
    return { success: true, message: '專案/子專案已設為暫緩' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '發生未知錯誤' };
  }
}

export async function resumeProject(projectId: string, subProjectId?: string) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    if (subProjectId) {
      await projectRef.collection('sub_projects').doc(subProjectId).update({ isOnHold: false });
    } else {
      await projectRef.update({ status: 'active', isOnHold: false });
    }
    revalidatePath('/dashboard');
    return { success: true, message: '專案已恢復' };
  } catch (error) {
    return { success: false, message: '恢復失敗' };
  }
}

export async function resumeProjects(projectIds: string[], subProjectsByProject: Record<string, string[]>) {
    try {
      const batch = db.batch();
      projectIds.forEach(pid => {
        batch.update(db.collection('projects').doc(pid), { isOnHold: false, status: 'active' });
      });
      for (const projectId in subProjectsByProject) {
        subProjectsByProject[projectId].forEach(spId => {
          batch.update(db.collection('projects').doc(projectId).collection('sub_projects').doc(spId), { isOnHold: false });
        });
      }
      await batch.commit();
      revalidatePath('/dashboard');
      return { success: true, message: '所選項目已恢復' };
    } catch (error) {
      return { success: false, message: '恢復失敗' };
    }
}

// -------------------------------------------------------------------------
// DATA FETCHING & DEDUPLICATION (The "Fix")
// -------------------------------------------------------------------------

async function getOptimizedProjectData(): Promise<{ allSubProjects: SubProjectWithLatestLog[], fullProjects: FullProject[] }> {
    const [projectsSnapshot, subProjectsSnapshot, progressLogsSnapshot, users] = await Promise.all([
        db.collection('projects').orderBy('createdAt', 'desc').get(),
        db.collectionGroup('sub_projects').get(),
        db.collectionGroup('progress_logs').get(), 
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    
    const projectsMap = new Map<string, FullProject>();
    projectsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        projectsMap.set(doc.id, {
            id: doc.id,
            caseNumber: data.caseNumber,
            name: data.name,
            status: data.status,
            createdBy: data.createdBy,
            projectPurpose: data.projectPurpose,
            currentStatusAndIssues: data.currentStatusAndIssues,
            yiehPhuiProjectManager: data.yiehPhuiProjectManager,
            tpmOfficeContact: data.tpmOfficeContact,
            egigaContact: data.egigaContact,
            isOnHold: data.isOnHold ?? false,
            onHoldReason: data.onHoldReason,
            onHoldStartDate: formatFirestoreDateOptional(data.onHoldStartDate),
            onHoldEndDate: formatFirestoreDateOptional(data.onHoldEndDate),
            onHoldNotes: data.onHoldNotes,
            createdAt: formatFirestoreDate(data.createdAt),
            subProjects: [],
        } as FullProject);
    });

    const getStartDateFromPeriod = (period: string): Date | null => {
        if (!period) return null;
        try {
            const dateString = period.split(' - ')[0].trim();
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch { return null; }
    };
    
    // 嚴格去重：每個子專案 ID 只保留一筆「最晚提報週」的週報
    const latestLogsMap = new Map<string, ProgressLog>();
    progressLogsSnapshot.docs.forEach(doc => {
        const logData = doc.data();
        // 優先從路徑獲取 SubProjectId 以防遺漏
        const subProjectId = doc.ref.parent.parent?.id || logData.subProjectId;

        if (!subProjectId || !logData.reportingPeriod) return;

        const currentLogDate = getStartDateFromPeriod(logData.reportingPeriod);
        if (!currentLogDate) return;

        const existingLog = latestLogsMap.get(subProjectId);
        let shouldReplace = false;

        if (!existingLog) {
            shouldReplace = true;
        } else {
            const existingLogDate = getStartDateFromPeriod(existingLog.reportingPeriod);
            if (existingLogDate && currentLogDate > existingLogDate) {
                shouldReplace = true;
            } else if (existingLogDate && currentLogDate.getTime() === existingLogDate.getTime()) {
                // 如果週別相同，則看編輯時間
                const currentUpdated = (logData.updatedAt as FirebaseFirestore.Timestamp)?.toDate() || new Date(0);
                const existingUpdated = new Date(existingLog.updatedAt as string);
                if (currentUpdated > existingUpdated) shouldReplace = true;
            }
        }

        if (shouldReplace) {
            latestLogsMap.set(subProjectId, {
                id: doc.id,
                subProjectId,
                reportingPeriod: logData.reportingPeriod,
                executionSummary: logData.executionSummary,
                nextWeekPlan: logData.nextWeekPlan,
                roadblocks: logData.roadblocks,
                completionPercentage: logData.completionPercentage,
                createdBy: logData.createdBy,
                updatedAt: formatFirestoreDate(logData.updatedAt),
                createdByName: userMap.get(logData.createdBy),
            } as ProgressLog);
        }
    });

    // 核心去重：確保每個子專案 ID 只會出現一次
    const processedSubProjectIds = new Set<string>();
    const allSubProjects: SubProjectWithLatestLog[] = [];

    // 先根據 ID 排序子專案，確保如果有重複文檔，處理順序一致
    const sortedSubProjectDocs = [...subProjectsSnapshot.docs].sort((a, b) => {
        const aCreatedAt = (a.data().createdAt as any)?.seconds || 0;
        const bCreatedAt = (b.data().createdAt as any)?.seconds || 0;
        return bCreatedAt - aCreatedAt; // 最新的文檔先處理
    });

    sortedSubProjectDocs.forEach(subProjectDoc => {
        if (processedSubProjectIds.has(subProjectDoc.id)) return; // 跳過已處理的重複 ID

        const subProjectData = subProjectDoc.data();
        const project = projectsMap.get(subProjectData.projectId);
        
        if (!project) return; 

        processedSubProjectIds.add(subProjectDoc.id);

        const latestLog = latestLogsMap.get(subProjectDoc.id) || null;
        const isEffectivelyOnHold = (subProjectData.isOnHold || project.isOnHold);

        let isOverdue = false;
        if (!isEffectivelyOnHold) {
            const sevenDaysAgo = subDays(new Date(), 7);
            isOverdue = latestLog?.updatedAt ? new Date(latestLog.updatedAt as string) < sevenDaysAgo : true;
        }

        const subProjectWithLog: SubProjectWithLatestLog = {
            id: subProjectDoc.id,
            projectId: project.id,
            name: subProjectData.name,
            owner: subProjectData.owner,
            expectedCompletionDate: formatFirestoreDate(subProjectData.expectedCompletionDate),
            actualCompletionDate: formatFirestoreDateOptional(subProjectData.actualCompletionDate),
            createdAt: formatFirestoreDate(subProjectData.createdAt),
            isOnHold: subProjectData.isOnHold ?? false,
            onHoldReason: subProjectData.onHoldReason,
            onHoldStartDate: formatFirestoreDateOptional(subProjectData.onHoldStartDate),
            onHoldEndDate: formatFirestoreDateOptional(subProjectData.onHoldEndDate),
            onHoldNotes: subProjectData.onHoldNotes,
            projectName: project.name,
            projectCaseNumber: project.caseNumber,
            projectPurpose: project.projectPurpose,
            currentStatusAndIssues: project.currentStatusAndIssues,
            yiehPhuiProjectManager: project.yiehPhuiProjectManager,
            tpmOfficeContact: project.tpmOfficeContact,
            egigaContact: project.egigaContact,
            ownerName: userMap.get(subProjectData.owner),
            latestLog,
            isOverdue,
            isParentOnHold: project.isOnHold ?? false,
        };
        
        allSubProjects.push(subProjectWithLog);
        project.subProjects.push(subProjectWithLog);
    });

    // 排序各專案下的子專案
    projectsMap.forEach(p => p.subProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()));

    return { allSubProjects, fullProjects: Array.from(projectsMap.values()) };
}

export const getFullProjectById = async (projectId: string): Promise<FullProject | null> => {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return null;
    const projectData = projectDoc.data()!;
    const [subProjectsSnapshot, users] = await Promise.all([
        projectDoc.ref.collection('sub_projects').orderBy('createdAt', 'asc').get(),
        getUsers()
    ]);
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const subProjects: SubProjectWithLatestLog[] = await Promise.all(subProjectsSnapshot.docs.map(async doc => {
        const spData = doc.data();
        const logs = await doc.ref.collection('progress_logs').orderBy('updatedAt', 'desc').limit(1).get();
        const latestLog = !logs.empty ? {
            id: logs.docs[0].id,
            subProjectId: logs.docs[0].data().subProjectId,
            reportingPeriod: logs.docs[0].data().reportingPeriod,
            executionSummary: logs.docs[0].data().executionSummary,
            nextWeekPlan: logs.docs[0].data().nextWeekPlan,
            roadblocks: logs.docs[0].data().roadblocks,
            completionPercentage: logs.docs[0].data().completionPercentage,
            createdBy: logs.docs[0].data().createdBy,
            updatedAt: formatFirestoreDate(logs.docs[0].data().updatedAt),
            createdByName: userMap.get(logs.docs[0].data().createdBy)
        } as ProgressLog : null;

        return {
            id: doc.id,
            projectId,
            name: spData.name,
            owner: spData.owner,
            expectedCompletionDate: formatFirestoreDate(spData.expectedCompletionDate),
            actualCompletionDate: formatFirestoreDateOptional(spData.actualCompletionDate),
            createdAt: formatFirestoreDate(spData.createdAt),
            isOnHold: spData.isOnHold ?? false,
            onHoldReason: spData.onHoldReason,
            onHoldStartDate: formatFirestoreDateOptional(spData.onHoldStartDate),
            onHoldEndDate: formatFirestoreDateOptional(spData.onHoldEndDate),
            onHoldNotes: spData.onHoldNotes,
            latestLog,
            isParentOnHold: projectData.isOnHold ?? false,
            isOverdue: false, // 簡化處理
        } as SubProjectWithLatestLog;
    }));

    return {
        id: projectDoc.id,
        caseNumber: projectData.caseNumber,
        name: projectData.name,
        status: projectData.status,
        createdBy: projectData.createdBy,
        projectPurpose: projectData.projectPurpose,
        currentStatusAndIssues: projectData.currentStatusAndIssues,
        yiehPhuiProjectManager: projectData.yiehPhuiProjectManager,
        tpmOfficeContact: projectData.tpmOfficeContact,
        egigaContact: projectData.egigaContact,
        isOnHold: projectData.isOnHold ?? false,
        onHoldReason: projectData.onHoldReason,
        onHoldStartDate: formatFirestoreDateOptional(projectData.onHoldStartDate),
        onHoldEndDate: formatFirestoreDateOptional(projectData.onHoldEndDate),
        onHoldNotes: projectData.onHoldNotes,
        createdAt: formatFirestoreDate(projectData.createdAt),
        subProjects,
    } as FullProject;
};

export const getFullProjects = async () => (await getOptimizedProjectData()).fullProjects;
export const getSubProjectsWithLatestLogs = async () => (await getOptimizedProjectData()).allSubProjects;

export const getUsers = async (): Promise<User[]> => {
    const snap = await db.collection('users').get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            uid: doc.id,
            email: data.email,
            displayName: data.displayName,
            role: data.role,
            status: data.status,
            createdAt: formatFirestoreDate(data.createdAt)
        } as User;
    });
};

export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    const snap = await db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).orderBy('updatedAt', 'desc').get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            subProjectId: data.subProjectId,
            reportingPeriod: data.reportingPeriod,
            executionSummary: data.executionSummary,
            nextWeekPlan: data.nextWeekPlan,
            roadblocks: data.roadblocks,
            completionPercentage: data.completionPercentage,
            createdBy: data.createdBy,
            updatedAt: formatFirestoreDate(data.updatedAt),
            createdByName: userMap.get(data.createdBy)
        } as ProgressLog;
    });
};
