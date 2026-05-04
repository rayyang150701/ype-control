
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, SubProjectWithLatestLog } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays, startOfWeek, endOfWeek, format } from 'date-fns';

/**
 * 安全時間轉換器：處理 Firestore Timestamp、ISO 字串或 Date 物件
 */
const getSafeTime = (date: any): number => {
    if (!date) return 0;
    try {
        if (typeof date === 'object' && date !== null && 'seconds' in date) {
            return date.seconds * 1000 + (Math.floor(date.nanoseconds / 1000000));
        }
        if (typeof date.toDate === 'function') {
            return date.toDate().getTime();
        }
        const time = new Date(date).getTime();
        return isNaN(time) ? 0 : time;
    } catch {
        return 0;
    }
};

/**
 * 格式化為 ISO 字串
 */
const formatISO = (date: any): string => {
    const time = getSafeTime(date);
    return time > 0 ? new Date(time).toISOString() : new Date().toISOString();
};

const formatISOOptional = (date: any): string | undefined => {
    const time = getSafeTime(date);
    return time > 0 ? new Date(time).toISOString() : undefined;
};

/**
 * 計算當前的週報區間字串 (格式: YYYY/MM/DD - MM/DD)
 */
const getCurrentReportingPeriod = () => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
};

// --- 成員管理 ---

export async function getUsers(): Promise<User[]> {
    const snap = await db.collection('users').get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: data.role || 'viewer',
            status: data.status || 'active',
            createdAt: formatISO(data.createdAt),
        };
    });
}

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

// --- 專案管理 ---

export async function createProject(data: any) {
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

    data.subProjects.forEach((sp: any) => {
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

export async function updateProject(projectId: string, data: any, originalSubProjectIds: string[]) {
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

            const currentSubProjectIds = data.subProjects.map((sp: any) => sp.id).filter(Boolean) as string[];
            const subProjectsToDelete = originalSubProjectIds.filter(id => !currentSubProjectIds.includes(id));
            
            subProjectsToDelete.forEach(id => {
                transaction.delete(projectRef.collection('sub_projects').doc(id));
            });

            data.subProjects.forEach((spData: any) => {
                const spRef = spData.id 
                    ? projectRef.collection('sub_projects').doc(spData.id)
                    : projectRef.collection('sub_projects').doc();

                const payload: any = {
                    name: spData.name,
                    owner: spData.owner,
                    expectedCompletionDate: spData.expectedCompletionDate ?? null,
                    actualCompletionDate: spData.actualCompletionDate ?? null,
                    projectId: projectId,
                };

                if (spData.id) {
                    transaction.update(spRef, payload);
                } else {
                    transaction.set(spRef, { ...payload, isOnHold: false, createdAt: FieldValue.serverTimestamp() });
                }
            });
        });
        
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功更新！' };
    } catch (error) {
        return { success: false, message: '更新失敗' };
    }
}

// --- 週報管理 ---

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
        updatedAt: formatISO(data.updatedAt),
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
 * 核心資料組合與去重邏輯
 * 加入「非本週則清空文字」的顯示判斷
 */
async function getOptimizedProjectData() {
    const [projectsSnap, subProjectsSnap, logsSnap, users] = await Promise.all([
        db.collection('projects').orderBy('createdAt', 'desc').get(),
        db.collectionGroup('sub_projects').get(),
        db.collectionGroup('progress_logs').get(),
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    const currentPeriod = getCurrentReportingPeriod();

    // 1. 主專案去重：以案號為 Key
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
            name: data.name || '',
            status: data.status || 'active',
            projectPurpose: data.projectPurpose || '',
            currentStatusAndIssues: data.currentStatusAndIssues || '',
            yiehPhuiProjectManager: data.yiehPhuiProjectManager || '',
            tpmOfficeContact: data.tpmOfficeContact || '',
            egigaContact: data.egigaContact || '',
            isOnHold: !!data.isOnHold,
            createdAt: formatISO(data.createdAt),
            subProjects: [],
        } as any);
    });

    // 2. 最新週報判定：依照更新時間 (updatedAt)
    const latestLogsMap = new Map<string, ProgressLog>();
    logsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.reportingPeriod === 'Excel 匯入') return;

        const spId = data.subProjectId || doc.ref.parent.parent?.id;
        if (!spId) return;

        const curTime = getSafeTime(data.updatedAt);
        const existing = latestLogsMap.get(spId);
        const existingTime = existing ? getSafeTime(existing.updatedAt) : 0;

        if (!existing || curTime > existingTime) {
            latestLogsMap.set(spId, {
                id: doc.id,
                subProjectId: spId,
                reportingPeriod: data.reportingPeriod || '',
                executionSummary: data.executionSummary || '',
                nextWeekPlan: data.nextWeekPlan || '',
                roadblocks: data.roadblocks || '',
                completionPercentage: data.completionPercentage || 0,
                updatedAt: formatISO(data.updatedAt),
                createdBy: data.createdBy || '',
                createdByName: userMap.get(data.createdBy) || '未知',
            } as any);
        }
    });

    // 3. 子專案組合與「本週更新」邏輯判斷
    const allSubProjects: SubProjectWithLatestLog[] = [];
    subProjectsSnap.docs.forEach(doc => {
        const data = doc.data();
        const project = projectsMap.get(data.projectId);
        if (!project) return;

        const rawLatestLog = latestLogsMap.get(doc.id) || null;
        
        // 核心邏輯：如果最新週報不是本週的，則在首頁顯示時清空文字內容，方便一眼辨識
        const latestLog = rawLatestLog ? {
            ...rawLatestLog,
            executionSummary: rawLatestLog.reportingPeriod === currentPeriod ? rawLatestLog.executionSummary : '',
            nextWeekPlan: rawLatestLog.reportingPeriod === currentPeriod ? rawLatestLog.nextWeekPlan : '',
            roadblocks: rawLatestLog.reportingPeriod === currentPeriod ? rawLatestLog.roadblocks : '',
        } : null;

        const sp: SubProjectWithLatestLog = {
            id: doc.id,
            projectId: project.id,
            name: data.name || '',
            owner: data.owner || '',
            ownerName: userMap.get(data.owner) || '未知',
            expectedCompletionDate: formatISO(data.expectedCompletionDate),
            actualCompletionDate: formatISOOptional(data.actualCompletionDate),
            isOnHold: !!data.isOnHold,
            isParentOnHold: project.isOnHold,
            latestLog,
            projectName: project.name,
            projectCaseNumber: project.caseNumber,
            tpmOfficeContact: project.tpmOfficeContact,
            isOverdue: false,
        } as any;

        if (!sp.isOnHold && !sp.isParentOnHold && (latestLog?.completionPercentage ?? 0) < 100) {
            const lastUpdateTime = latestLog ? getSafeTime(latestLog.updatedAt) : 0;
            const sevenDaysAgo = subDays(new Date(), 7).getTime();
            sp.isOverdue = lastUpdateTime < sevenDaysAgo;
        }

        allSubProjects.push(sp);
        project.subProjects.push(sp);
    });

    // 4. 排序：案號由大到小
    const sortByKey = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

    const sortedAllSubProjects = allSubProjects.sort((a, b) => sortByKey(a.projectCaseNumber || '', b.projectCaseNumber || ''));
    const sortedFullProjects = Array.from(projectsMap.values())
        .filter(p => p.subProjects.length > 0)
        .sort((a, b) => sortByKey(a.caseNumber, b.caseNumber));

    return { 
        allSubProjects: sortedAllSubProjects, 
        fullProjects: sortedFullProjects 
    };
}

export const getSubProjectsWithLatestLogs = async () => (await getOptimizedProjectData()).allSubProjects;
export const getFullProjects = async () => (await getOptimizedProjectData()).fullProjects;

export const getFullProjectById = async (id: string) => {
    const projects = await getFullProjects();
    return projects.find(p => p.id === id) || null;
};

/**
 * 取得單一子專案的所有歷史週報 (保留完整資料)
 */
export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    const snap = await db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return snap.docs
        .map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                updatedAt: formatISO(data.updatedAt),
                createdByName: userMap.get(data.createdBy) || '未知',
            } as any;
        })
        .filter(l => l.reportingPeriod !== 'Excel 匯入')
        .sort((a, b) => getSafeTime(b.updatedAt) - getSafeTime(a.updatedAt));
};
