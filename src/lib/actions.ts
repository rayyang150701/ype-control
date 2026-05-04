'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog, SubProject } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays } from 'date-fns';

/**
 * 格式化 Firestore 的日期格式為 ISO 字串
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
 * 強力日期提取器：從週報字串中抓取第一個 YYYY/MM/DD
 * 確保 5/04 永遠排在 4/27 之前，不受補登（更新時間）影響
 */
export const getSafeTimeFromPeriod = (period: string): number => {
    if (!period || typeof period !== 'string' || period === 'Excel 匯入') return 0;
    try {
        const match = period.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
        if (match) {
            const dateStr = match[1].replace(/\//g, '-');
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        }
    } catch { 
        return 0; 
    }
    return 0;
};

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

// --- 表單驗證 ---
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

const editProjectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  projectPurpose: z.string().optional(),
  currentStatusAndIssues: z.string().optional(),
  yiehPhuiProjectManager: z.string().optional(),
  tpmOfficeContact: z.string().optional(),
  egigaContact: z.string().optional(),
  subProjects: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().min(1, '必須選擇一位負責人'),
    expectedCompletionDate: z.date().optional(),
    actualCompletionDate: z.date().optional(),
  })).min(1, '至少需要一個子專案'),
});

// --- Actions ---

export async function createUser(data: any) {
  try {
    const newUserRef = db.collection('users').doc();
    await newUserRef.set({
      uid: newUserRef.id,
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/users');
    return { success: true, message: '成員已成功建立！' };
  } catch (error) {
    return { success: false, message: '建立成員時發生錯誤。' };
  }
}

export async function updateUser(uid: string, data: any) {
  try {
    await db.collection('users').doc(uid).update(data);
    revalidatePath('/users');
    return { success: true, message: '成員已成功更新！' };
  } catch (error) {
    return { success: false, message: '更新成員時發生錯誤。' };
  }
}

export async function deleteUser(uid: string) {
    try {
        await db.collection('users').doc(uid).delete();
        revalidatePath('/users');
        return { success: true, message: '成員已成功刪除！' };
    } catch (error) {
        return { success: false, message: '刪除成員時發生錯誤。' };
    }
}

export async function createProject(data: z.infer<typeof projectSchema>) {
    const batch = db.batch();
    const userId = 'admin-user'; 

    const newProjectRef = db.collection('projects').doc();
    batch.set(newProjectRef, {
        name: data.name,
        caseNumber: String(data.caseNumber).trim(),
        status: 'active',
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
        projectPurpose: data.projectPurpose ?? '',
        currentStatusAndIssues: data.currentStatusAndIssues ?? '',
        yiehPhuiProjectManager: data.yiehPhuiProjectManager ?? '',
        tpmOfficeContact: data.tpmOfficeContact ?? '',
        egigaContact: data.egigaContact ?? '',
        isOnHold: false,
    });

    data.subProjects.forEach(sp => {
        const spRef = db.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
        batch.set(spRef, {
            name: sp.name,
            owner: sp.owner,
            expectedCompletionDate: sp.expectedCompletionDate ?? null,
            actualCompletionDate: sp.actualCompletionDate ?? null,
            projectId: newProjectRef.id,
            createdAt: FieldValue.serverTimestamp(),
            isOnHold: false,
        });
    });

    try {
        await batch.commit();
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功建立！' };
    } catch (error) {
        return { success: false, message: '建立專案失敗' };
    }
}

export async function updateProject(projectId: string, data: z.infer<typeof editProjectSchema>, originalSubProjectIds: string[]) {
    try {
        await db.runTransaction(async (transaction) => {
            const projectRef = db.collection('projects').doc(projectId);
            transaction.update(projectRef, {
                caseNumber: String(data.caseNumber).trim(),
                name: data.name,
                projectPurpose: data.projectPurpose ?? '',
                currentStatusAndIssues: data.currentStatusAndIssues ?? '',
                yiehPhuiProjectManager: data.yiehPhuiProjectManager ?? '',
                tpmOfficeContact: data.tpmOfficeContact ?? '',
                egigaContact: data.egigaContact ?? '',
            });

            const currentSubProjectIds = data.subProjects.map(sp => sp.id).filter(Boolean) as string[];
            const subProjectsToDelete = originalSubProjectIds.filter(id => !currentSubProjectIds.includes(id));
            
            subProjectsToDelete.forEach(id => {
                transaction.delete(projectRef.collection('sub_projects').doc(id));
            });

            data.subProjects.forEach(spData => {
                const spRef = spData.id 
                    ? projectRef.collection('sub_projects').doc(spData.id)
                    : projectRef.collection('sub_projects').doc();

                const payload = {
                    name: spData.name,
                    owner: spData.owner,
                    expectedCompletionDate: spData.expectedCompletionDate ?? null,
                    actualCompletionDate: spData.actualCompletionDate ?? null,
                    projectId: projectId,
                    isOnHold: false,
                };

                if (spData.id) {
                    transaction.update(spRef, payload);
                } else {
                    transaction.set(spRef, { ...payload, createdAt: FieldValue.serverTimestamp() });
                }
            });
        });
        
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功更新！' };
    } catch (error) {
        return { success: false, message: '更新失敗' };
    }
}

export async function addProgressLog(projectId: string, subProjectId: string, logData: any): Promise<ProgressLog> {
    const userId = 'admin-user'; 
    const logRef = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    
    const payload = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
    };

    await logRef.set(payload);
    revalidatePath('/dashboard');
    
    return {
        id: logRef.id,
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: new Date().toISOString(),
    } as ProgressLog;
}

export async function updateProgressLog(logId: string, projectId: string, subProjectId: string, logData: any): Promise<ProgressLog> {
    const logRef = db.doc(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs/${logId}`);
    await logRef.update({
        ...logData,
        updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/dashboard');
    const doc = await logRef.get();
    const data = doc.data()!;
    return {
        id: logId,
        ...data,
        updatedAt: formatFirestoreDate(data.updatedAt),
    } as ProgressLog;
}

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    const projectRef = db.collection('projects').doc(projectId);
    await db.runTransaction(async (transaction) => {
        for (const spId of subProjectIds) {
            const spRef = projectRef.collection('sub_projects').doc(spId);
            const logs = await spRef.collection('progress_logs').get();
            logs.docs.forEach(log => transaction.delete(log.ref));
            transaction.delete(spRef);
        }
    });
    revalidatePath('/dashboard');
}

export async function setProjectOnHold(projectId: string, subProjectIds: string[], onHoldData: any) {
    try {
        const batch = db.batch();
        const projectRef = db.collection('projects').doc(projectId);
        const onHoldPayload = {
            isOnHold: true,
            onHoldReason: onHoldData.reason,
            onHoldStartDate: onHoldData.startDate,
            onHoldEndDate: onHoldData.endDate ?? null,
            onHoldNotes: onHoldData.notes ?? '',
        };

        const subProjectsSnapshot = await projectRef.collection('sub_projects').get();
        if (subProjectIds.length === subProjectsSnapshot.size) {
            batch.update(projectRef, { ...onHoldPayload, status: 'on-hold' });
        }

        subProjectIds.forEach(id => {
            batch.update(projectRef.collection('sub_projects').doc(id), onHoldPayload);
        });

        await batch.commit();
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e) {
        return { success: false, message: '設定失敗' };
    }
}

export async function resumeProject(projectId: string, subProjectId?: string) {
    const projectRef = db.collection('projects').doc(projectId);
    if (subProjectId) {
        await projectRef.collection('sub_projects').doc(subProjectId).update({ isOnHold: false });
    } else {
        await projectRef.update({ status: 'active', isOnHold: false });
    }
    revalidatePath('/dashboard');
    return { success: true };
}

export async function resumeProjects(projectIds: string[], subProjectsByProject: any) {
    const batch = db.batch();
    projectIds.forEach(id => batch.update(db.collection('projects').doc(id), { isOnHold: false, status: 'active' }));
    for (const pid in subProjectsByProject) {
        subProjectsByProject[pid].forEach((spid: string) => {
            batch.update(db.collection('projects').doc(pid).collection('sub_projects').doc(spid), { isOnHold: false });
        });
    }
    await batch.commit();
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * 核心淨化邏輯：
 * 1. 案號去重：只保留最新的案號文檔
 * 2. 週報判定：優先解析日期，補登資料不干擾排序
 * 3. 徹底移除 Excel 匯入
 */
async function getOptimizedProjectData() {
    const [projectsSnap, subProjectsSnap, logsSnap, users] = await Promise.all([
        db.collection('projects').orderBy('createdAt', 'desc').get(),
        db.collectionGroup('sub_projects').get(),
        db.collectionGroup('progress_logs').get(),
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    // 1. 案號強力去重
    const projectsMap = new Map<string, FullProject>();
    const caseNumberProcessed = new Set<string>();

    projectsSnap.docs.forEach(doc => {
        const data = doc.data();
        const caseNumber = String(data.caseNumber || '').trim();
        if (!caseNumber || caseNumberProcessed.has(caseNumber)) return;
        
        caseNumberProcessed.add(caseNumber);
        projectsMap.set(doc.id, {
            id: doc.id,
            caseNumber,
            name: data.name,
            status: data.status,
            projectPurpose: data.projectPurpose || '',
            currentStatusAndIssues: data.currentStatusAndIssues || '',
            yiehPhuiProjectManager: data.yiehPhuiProjectManager || '',
            tpmOfficeContact: data.tpmOfficeContact || '',
            egigaContact: data.egigaContact || '',
            isOnHold: !!data.isOnHold,
            createdAt: formatFirestoreDate(data.createdAt),
            subProjects: [],
        } as FullProject);
    });

    // 2. 週報判定與去重
    const latestLogsMap = new Map<string, ProgressLog>();
    logsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.reportingPeriod === 'Excel 匯入') return;

        const spId = doc.ref.parent.parent?.id;
        if (!spId) return;

        const curPeriodTime = getSafeTimeFromPeriod(data.reportingPeriod);
        if (curPeriodTime === 0) return;

        const existing = latestLogsMap.get(spId);
        let replace = false;

        if (!existing) {
            replace = true;
        } else {
            const exPeriodTime = getSafeTimeFromPeriod(existing.reportingPeriod);
            if (curPeriodTime > exPeriodTime) {
                replace = true;
            } else if (curPeriodTime === exPeriodTime) {
                if (getSafeTime(data.updatedAt) > getSafeTime(existing.updatedAt)) {
                    replace = true;
                }
            }
        }

        if (replace) {
            latestLogsMap.set(spId, {
                id: doc.id,
                ...data,
                updatedAt: formatFirestoreDate(data.updatedAt),
                createdByName: userMap.get(data.createdBy) || '未知',
            } as any);
        }
    });

    // 3. 組合與淨化
    const allSubProjects: SubProjectWithLatestLog[] = [];
    subProjectsSnap.docs.forEach(doc => {
        const data = doc.data();
        const project = projectsMap.get(data.projectId);
        if (!project) return;

        const latestLog = latestLogsMap.get(doc.id) || null;
        const sp: SubProjectWithLatestLog = {
            id: doc.id,
            projectId: project.id,
            name: data.name,
            owner: data.owner,
            ownerName: userMap.get(data.owner) || '未知',
            expectedCompletionDate: formatFirestoreDate(data.expectedCompletionDate),
            actualCompletionDate: formatFirestoreDateOptional(data.actualCompletionDate),
            isOnHold: !!data.isOnHold,
            isParentOnHold: project.isOnHold,
            latestLog,
            projectName: project.name,
            projectCaseNumber: project.caseNumber,
            tpmOfficeContact: project.tpmOfficeContact,
            isOverdue: false, // 暫不計算
        } as any;

        // 計算逾期 (非暫緩且進度未達 100 且 7天未報)
        if (!sp.isOnHold && !sp.isParentOnHold && (latestLog?.completionPercentage ?? 0) < 100) {
            const lastUpdate = latestLog ? new Date(latestLog.updatedAt as string) : new Date(0);
            sp.isOverdue = lastUpdate < subDays(new Date(), 7);
        }

        allSubProjects.push(sp);
        project.subProjects.push(sp);
    });

    return { 
        allSubProjects, 
        fullProjects: Array.from(projectsMap.values()).filter(p => p.subProjects.length > 0)
    };
}

export const getSubProjectsWithLatestLogs = async () => (await getOptimizedProjectData()).allSubProjects;
export const getFullProjects = async () => (await getOptimizedProjectData()).fullProjects;

export const getFullProjectById = async (id: string) => {
    const projects = await getFullProjects();
    return projects.find(p => p.id === id) || null;
};

export const getUsers = async (): Promise<User[]> => {
    const snap = await db.collection('users').get();
    return snap.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id,
        createdAt: formatFirestoreDate(doc.data().createdAt),
    })) as any;
};

export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    const snap = await db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return snap.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: formatFirestoreDate(doc.data().updatedAt),
            createdByName: userMap.get(doc.data().createdBy) || '未知',
        } as any))
        .filter(l => l.reportingPeriod !== 'Excel 匯入')
        .sort((a, b) => {
            const timeA = getSafeTimeFromPeriod(a.reportingPeriod);
            const timeB = getSafeTimeFromPeriod(b.reportingPeriod);
            if (timeB !== timeA) return timeB - timeA;
            return getSafeTime(b.updatedAt) - getSafeTime(a.updatedAt);
        });
};
