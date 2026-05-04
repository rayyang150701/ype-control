'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog, SubProject } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays } from 'date-fns';

/**
 * 格式化 Firestore 的日期格式為 ISO 字串，確保序列化安全
 */
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

/**
 * 格式化可選的 Firestore 日期格式
 */
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

/**
 * 從提報區間字串解析出起始日期，並返回安全的毫秒數值
 */
export const getSafeTimeFromPeriod = (period: string): number => {
    if (!period || typeof period !== 'string') return 0;
    try {
        const parts = period.split(' - ');
        if (parts.length < 1) return 0;
        const date = new Date(parts[0].trim().replace(/\//g, '-'));
        const time = date.getTime();
        return isNaN(time) ? 0 : time;
    } catch { 
        return 0; 
    }
};

/**
 * 安全地取得日期的毫秒數值
 */
const getSafeTime = (date: any): number => {
    if (!date) return 0;
    try {
        if (date.toDate && typeof date.toDate === 'function') {
            return date.toDate().getTime();
        }
        const time = new Date(date).getTime();
        return isNaN(time) ? 0 : time;
    } catch {
        return 0;
    }
};

// --- 表單驗證 Schema ---
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

// --- Server Actions ---

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

export async function createProject(data: z.infer<typeof projectSchema>) {
    const batch = db.batch();
    const userId = 'user-3'; 

    const newProjectRef = db.collection('projects').doc();
    const newProjectData = {
        name: data.name,
        caseNumber: String(data.caseNumber),
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
                caseNumber: String(data.caseNumber),
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
    const userId = 'user-1'; 

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

/**
 * 核心高效能資料組合邏輯：強力去重、最新週報判定
 */
async function getOptimizedProjectData(): Promise<{ allSubProjects: SubProjectWithLatestLog[], fullProjects: FullProject[] }> {
    const [projectsSnapshot, subProjectsSnapshot, progressLogsSnapshot, users] = await Promise.all([
        db.collection('projects').orderBy('createdAt', 'desc').get(),
        db.collectionGroup('sub_projects').get(),
        db.collectionGroup('progress_logs').get(), 
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    
    // 1. 主專案強力去重：以案號 (caseNumber) 為主，同一案號只保留最新的文檔
    const projectsMap = new Map<string, FullProject>();
    const caseNumberToProjectId = new Map<string, string>();

    projectsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const caseNumber = String(data.caseNumber || '').trim();
        if (!caseNumber) return;
        
        // 案號去重機制：因為已依 createdAt 降序排列，所以第一個遇到的就是最新的案號文檔
        if (caseNumberToProjectId.has(caseNumber)) return;
        caseNumberToProjectId.set(caseNumber, doc.id);

        projectsMap.set(doc.id, {
            id: doc.id,
            caseNumber: caseNumber,
            name: String(data.name || ''),
            status: String(data.status || 'active'),
            createdBy: String(data.createdBy || ''),
            projectPurpose: String(data.projectPurpose || ''),
            currentStatusAndIssues: String(data.currentStatusAndIssues || ''),
            yiehPhuiProjectManager: String(data.yiehPhuiProjectManager || ''),
            tpmOfficeContact: String(data.tpmOfficeContact || ''),
            egigaContact: String(data.egigaContact || ''),
            isOnHold: data.isOnHold === true,
            onHoldReason: data.onHoldReason || '',
            onHoldStartDate: formatFirestoreDateOptional(data.onHoldStartDate),
            onHoldEndDate: formatFirestoreDateOptional(data.onHoldEndDate),
            onHoldNotes: data.onHoldNotes || '',
            createdAt: formatFirestoreDate(data.createdAt),
            subProjects: [],
        } as FullProject);
    });

    // 2. 最新週報判定邏輯：精準找出每個子專案日期最晚且更新最晚的一筆
    const latestLogsMap = new Map<string, ProgressLog>();
    progressLogsSnapshot.docs.forEach(doc => {
        const logData = doc.data();
        // 優先從父路徑取得子專案 ID
        const subProjectId = doc.ref.parent.parent?.id || logData.subProjectId;
        if (!subProjectId || !logData.reportingPeriod) return;

        const currentTime = getSafeTimeFromPeriod(logData.reportingPeriod);
        if (currentTime === 0) return;

        const existingLog = latestLogsMap.get(subProjectId);
        let shouldReplace = false;

        if (!existingLog) {
            shouldReplace = true;
        } else {
            const existingTime = getSafeTimeFromPeriod(existingLog.reportingPeriod);
            if (currentTime > existingTime) {
                shouldReplace = true;
            } else if (currentTime === existingTime) {
                // 週別相同，比較寫入時間
                const currentUpdated = getSafeTime(logData.updatedAt);
                const existingUpdated = getSafeTime(existingLog.updatedAt);
                if (currentUpdated > existingUpdated) shouldReplace = true;
            }
        }

        if (shouldReplace) {
            latestLogsMap.set(subProjectId, {
                id: doc.id,
                subProjectId,
                reportingPeriod: String(logData.reportingPeriod),
                executionSummary: String(logData.executionSummary || ''),
                nextWeekPlan: String(logData.nextWeekPlan || ''),
                roadblocks: String(logData.roadblocks || ''),
                completionPercentage: Number(logData.completionPercentage || 0),
                createdBy: String(logData.createdBy || ''),
                updatedAt: formatFirestoreDate(logData.updatedAt),
                createdByName: userMap.get(logData.createdBy) || '未知',
            } as ProgressLog);
        }
    });

    // 3. 組合子專案，並自動過濾重複的子專案 ID
    const allSubProjects: SubProjectWithLatestLog[] = [];
    const processedSubProjectIds = new Set<string>();

    subProjectsSnapshot.docs.forEach(subProjectDoc => {
        // 子專案 ID 去重
        if (processedSubProjectIds.has(subProjectDoc.id)) return;
        
        const subProjectData = subProjectDoc.data();
        const project = projectsMap.get(subProjectData.projectId);
        if (!project) return; // 如果主專案被去重過濾了，其下的子專案也跟著過濾

        processedSubProjectIds.add(subProjectDoc.id);

        const latestLog = latestLogsMap.get(subProjectDoc.id) || null;
        const isEffectivelyOnHold = (subProjectData.isOnHold === true || project.isOnHold === true);

        // 逾期判定
        let isOverdue = false;
        if (!isEffectivelyOnHold && (latestLog?.completionPercentage ?? 0) < 100) {
            const sevenDaysAgo = subDays(new Date(), 7);
            const lastUpdateDate = latestLog?.updatedAt ? new Date(latestLog.updatedAt as string) : new Date(0);
            isOverdue = lastUpdateDate < sevenDaysAgo;
        }

        const subProjectWithLog: SubProjectWithLatestLog = {
            id: subProjectDoc.id,
            projectId: project.id,
            name: String(subProjectData.name || ''),
            owner: String(subProjectData.owner || ''),
            expectedCompletionDate: formatFirestoreDate(subProjectData.expectedCompletionDate),
            actualCompletionDate: formatFirestoreDateOptional(subProjectData.actualCompletionDate),
            createdAt: formatFirestoreDate(subProjectData.createdAt),
            isOnHold: subProjectData.isOnHold === true,
            projectName: project.name,
            projectCaseNumber: project.caseNumber,
            projectPurpose: project.projectPurpose,
            currentStatusAndIssues: project.currentStatusAndIssues,
            yiehPhuiProjectManager: project.yiehPhuiProjectManager,
            tpmOfficeContact: project.tpmOfficeContact,
            egigaContact: project.egigaContact,
            ownerName: userMap.get(subProjectData.owner) || '未知',
            latestLog,
            isOverdue,
            isParentOnHold: project.isOnHold === true,
        };
        
        allSubProjects.push(subProjectWithLog);
        project.subProjects.push(subProjectWithLog);
    });

    // 最後過濾：只回傳有子專案的專案文檔，徹底清除重複或空的幽靈專案
    const finalFullProjects = Array.from(projectsMap.values())
        .filter(p => p.subProjects.length > 0)
        .map(p => {
            p.subProjects.sort((a,b) => getSafeTime(a.createdAt) - getSafeTime(b.createdAt));
            return p;
        });

    return { allSubProjects, fullProjects: finalFullProjects };
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
        const logs = await doc.ref.collection('progress_logs').get();
        
        let latestLog: ProgressLog | null = null;
        if (!logs.empty) {
            const sortedLogs = logs.docs.map(d => ({ id: d.id, ...d.data() }) as any)
                .sort((a, b) => {
                    const timeA = getSafeTimeFromPeriod(a.reportingPeriod);
                    const timeB = getSafeTimeFromPeriod(b.reportingPeriod);
                    if (timeB !== timeA) return timeB - timeA;
                    return getSafeTime(b.updatedAt) - getSafeTime(a.updatedAt);
                });
            
            const l = sortedLogs[0];
            latestLog = {
                id: l.id,
                subProjectId: l.subProjectId,
                reportingPeriod: l.reportingPeriod,
                executionSummary: l.executionSummary,
                nextWeekPlan: l.nextWeekPlan,
                roadblocks: l.roadblocks,
                completionPercentage: l.completionPercentage,
                createdBy: l.createdBy,
                updatedAt: formatFirestoreDate(l.updatedAt),
                createdByName: userMap.get(l.createdBy)
            } as ProgressLog;
        }

        return {
            id: doc.id,
            projectId,
            name: spData.name,
            owner: spData.owner,
            expectedCompletionDate: formatFirestoreDate(spData.expectedCompletionDate),
            actualCompletionDate: formatFirestoreDateOptional(spData.actualCompletionDate),
            createdAt: formatFirestoreDate(spData.createdAt),
            isOnHold: spData.isOnHold ?? false,
            latestLog,
            isParentOnHold: projectData.isOnHold ?? false,
            isOverdue: false,
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
    const snap = await db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    
    const logs = snap.docs.map(doc => {
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

    return logs.sort((a, b) => {
        const timeA = getSafeTimeFromPeriod(a.reportingPeriod);
        const timeB = getSafeTimeFromPeriod(b.reportingPeriod);
        if (timeB !== timeA) return timeB - timeA;
        return getSafeTime(b.updatedAt) - getSafeTime(a.updatedAt);
    });
};
