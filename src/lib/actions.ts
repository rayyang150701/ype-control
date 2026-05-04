'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog, UserRole, UserStatus, SubProject } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { format, differenceInDays, subDays } from 'date-fns';

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
      ...data,
      uid: newUserRef.id,
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
      ...data,
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
      ...logData,
      updatedAt: FieldValue.serverTimestamp(),
    });
  
    revalidatePath('/dashboard');
    const updatedLogDoc = await logRef.get();
    const data = updatedLogDoc.data()!;
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return {
      id: logRef.id,
      ...data,
      updatedAt: (data.updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
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
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
    });
    
    revalidatePath('/dashboard');
    return {
        id: newLogRef.id,
        ...logData,
        subProjectId,
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
        db.collectionGroup('progress_logs').get(), // 獲取所有日誌進行手動去重
        getUsers()
    ]);

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    
    const projectsMap = new Map<string, FullProject>();
    projectsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        projectsMap.set(doc.id, {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as FirebaseFirestore.Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            subProjects: [],
        } as FullProject);
    });

    const getStartDateFromPeriod = (period: string): Date | null => {
        try {
            const dateString = period.split(' - ')[0];
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch { return null; }
    };
    
    // 嚴格去重：每個子專案只保留一筆「最新週報」
    const latestLogsMap = new Map<string, ProgressLog>();
    progressLogsSnapshot.docs.forEach(doc => {
        const logData = doc.data();
        // 優先從路徑提取真正所屬的 SID，確保不會張冠李戴
        const sidFromPath = doc.ref.parent.parent?.id;
        const subProjectId = sidFromPath || logData.subProjectId;

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
                // 如果週別相同，比對編輯時間
                const currentUpdated = (logData.updatedAt as FirebaseFirestore.Timestamp)?.toDate() || new Date(0);
                const existingUpdated = new Date(existingLog.updatedAt as string);
                if (currentUpdated > existingUpdated) shouldReplace = true;
            }
        }

        if (shouldReplace) {
            latestLogsMap.set(subProjectId, {
                ...logData,
                id: doc.id,
                subProjectId,
                updatedAt: (logData.updatedAt as FirebaseFirestore.Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                createdByName: userMap.get(logData.createdBy),
            } as ProgressLog);
        }
    });

    const allSubProjects: SubProjectWithLatestLog[] = [];
    subProjectsSnapshot.docs.forEach(subProjectDoc => {
        const subProjectData = subProjectDoc.data();
        const project = projectsMap.get(subProjectData.projectId);
        
        if (!project) return; // 過濾掉孤兒資料

        const latestLog = latestLogsMap.get(subProjectDoc.id) || null;
        const isEffectivelyOnHold = (subProjectData.isOnHold || project.isOnHold);

        let isOverdue = false;
        if (!isEffectivelyOnHold) {
            const sevenDaysAgo = subDays(new Date(), 7);
            isOverdue = latestLog?.updatedAt ? new Date(latestLog.updatedAt as string) < sevenDaysAgo : true;
        }

        const subProjectWithLog: SubProjectWithLatestLog = {
            ...subProjectData,
            id: subProjectDoc.id,
            expectedCompletionDate: subProjectData.expectedCompletionDate ? (subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            actualCompletionDate: subProjectData.actualCompletionDate ? (subProjectData.actualCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            createdAt: subProjectData.createdAt ? (subProjectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString(),
            projectId: project.id,
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
            isOnHold: subProjectData.isOnHold ?? false,
            isParentOnHold: project.isOnHold ?? false,
        };
        
        allSubProjects.push(subProjectWithLog);
        project.subProjects.push(subProjectWithLog);
    });

    // 排序
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
            ...logs.docs[0].data(),
            id: logs.docs[0].id,
            updatedAt: (logs.docs[0].data().updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
            createdByName: userMap.get(logs.docs[0].data().createdBy)
        } as ProgressLog : null;

        return {
            ...spData,
            id: doc.id,
            expectedCompletionDate: spData.expectedCompletionDate ? (spData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            actualCompletionDate: spData.actualCompletionDate ? (spData.actualCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            projectId,
            latestLog,
            isOnHold: spData.isOnHold ?? false,
            isParentOnHold: projectData.isOnHold ?? false,
        } as SubProjectWithLatestLog;
    }));

    return {
        id: projectDoc.id,
        ...projectData,
        subProjects,
    } as FullProject;
};

export const getFullProjects = async () => (await getOptimizedProjectData()).fullProjects;
export const getSubProjectsWithLatestLogs = async () => (await getOptimizedProjectData()).allSubProjects;
export const getUsers = async (): Promise<User[]> => {
    const snap = await db.collection('users').get();
    return snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as FirebaseFirestore.Timestamp)?.toDate().toISOString() || new Date().toISOString()
    } as User));
};

export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    const snap = await db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).orderBy('updatedAt', 'desc').get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    return snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        updatedAt: (doc.data().updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
        createdByName: userMap.get(doc.data().createdBy)
    } as ProgressLog));
};
