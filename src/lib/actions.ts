
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
    const userId = 'user-3'; // Placeholder for actual logged-in user

    const newProjectRef = db.collection('projects').doc();
    const newProjectData: Omit<Project, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
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
        throw new Error(`Project ID was not provided for sub-project ID: ${subProjectId}`);
    }
  
    const logRef = db.doc(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs/${logId}`);
  
    const updateData = {
      ...logData,
      updatedAt: FieldValue.serverTimestamp(),
    };
  
    await logRef.update(updateData);
  
    revalidatePath('/dashboard');
  
    const updatedLogDoc = await logRef.get();
    const updatedLog = updatedLogDoc.data()!;
  
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
  
    const updatedAt = (updatedLog.updatedAt as FirebaseFirestore.Timestamp);

    return {
      id: logRef.id,
      ...updatedLog,
      updatedAt: updatedAt.toDate().toISOString(),
      createdByName: userMap.get(updatedLog.createdBy),
    } as ProgressLog;
}

export async function addProgressLog (
    projectId: string,
    subProjectId: string, 
    logData: Omit<ProgressLog, 'id' | 'subProjectId' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<ProgressLog> {
    const userId = 'user-1'; // Placeholder

    if (!projectId) {
        throw new Error(`Project ID was not provided.`);
    }
    
    const newLogRef = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    
    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
    };
    
    await newLogRef.set(newLogData);
    
    revalidatePath('/dashboard');

    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));
    const now = new Date().toISOString();

    return {
        id: newLogRef.id,
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: now, 
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
  // AI features temporarily disabled to resolve build issues.
  console.error('AI suggestion temporarily disabled.');
  return { suggestedRoadblock: null, suggestedPercentage: null };
}

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    if (!projectId || !subProjectIds || subProjectIds.length === 0) {
        throw new Error('Project ID and at least one Sub-project ID are required.');
    }

    const projectRef = db.collection('projects').doc(projectId);

    await db.runTransaction(async (transaction) => {
        for (const subProjectId of subProjectIds) {
            const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
            
            const progressLogsSnapshot = await subProjectRef.collection('progress_logs').get();
            progressLogsSnapshot.docs.forEach(logDoc => transaction.delete(logDoc.ref));
            
            transaction.delete(subProjectRef);
        }
    });

    revalidatePath('/dashboard');
}

// On-Hold and Resume Actions
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
    const isAllSubProjectsSelected = subProjectIds.length === allSubProjectIdsInProject.length && allSubProjectIdsInProject.every(id => subProjectIds.includes(id));
    
    const onHoldPayload = {
        isOnHold: true,
        onHoldReason: onHoldData.reason,
        onHoldStartDate: onHoldData.startDate,
        onHoldEndDate: onHoldData.endDate ?? null,
        onHoldNotes: onHoldData.notes ?? '',
    };

    if (isAllSubProjectsSelected) {
      await projectRef.update({
        ...onHoldPayload,
        status: 'on-hold',
      });
    }

    const batch = db.batch();
    subProjectIds.forEach(id => {
      const subProjectRef = subProjectsCol.doc(id);
      batch.update(subProjectRef, onHoldPayload);
    });
    await batch.commit();
    
    revalidatePath('/dashboard');
    return { success: true, message: '專案/子專案已成功設為暫緩' };
  } catch (error) {
    console.error('設定暫緩失敗:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : '設定暫緩時發生未知錯誤'
    };
  }
}

export async function resumeProject(projectId: string, subProjectId?: string) {
  try {
    const projectRef = db.collection('projects').doc(projectId);

    if (subProjectId) {
      const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
      await subProjectRef.update({
        isOnHold: false,
        onHoldEndDate: new Date(),
      });
    } else {
      await projectRef.update({
        status: 'active',
        isOnHold: false,
        onHoldEndDate: new Date(),
      });
    }
    
    revalidatePath('/dashboard');
    return { success: true, message: '專案已恢復進行' };
  } catch (error) {
    console.error('恢復專案失敗:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : '恢復專案時發生未知錯誤'
    };
  }
}

export async function resumeProjects(projectIds: string[], subProjectsByProject: Record<string, string[]>) {
    try {
      const batch = db.batch();
      const resumeUpdate = {
        isOnHold: false,
        onHoldEndDate: new Date(),
      };
  
      projectIds.forEach(pid => {
        const projectRef = db.collection('projects').doc(pid);
        batch.update(projectRef, { ...resumeUpdate, status: 'active' });
      });
  
      for (const projectId in subProjectsByProject) {
        const spIds = subProjectsByProject[projectId];
        spIds.forEach(spId => {
          const subProjectRef = db.collection('projects').doc(projectId).collection('sub_projects').doc(spId);
          batch.update(subProjectRef, resumeUpdate);
        });
      }
  
      await batch.commit();
      revalidatePath('/dashboard');
      return { success: true, message: '所選項目已成功恢復' };
    } catch (error) {
      console.error('恢復專案/子專案失敗:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '恢復專案時發生未知錯誤',
      };
    }
}


// Data fetching functions

export const getUsers = async (): Promise<User[]> => {
    const usersCol = db.collection('users');
    const userSnapshot = await usersCol.get();
    const userList = userSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt as FirebaseFirestore.Timestamp;
      return {
        uid: doc.id,
        displayName: data.displayName || '',
        email: data.email || '',
        role: data.role || 'viewer',
        status: data.status || 'pending',
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
      } as User;
    });
    return userList;
};

export const getProgressLogsForSubProject = async (projectId: string, subProjectId: string): Promise<ProgressLog[]> => {
    if (!projectId) {
        throw new Error('Project ID is required to fetch progress logs.');
    }
    const logsCol = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`);
    const q = logsCol.orderBy('updatedAt', 'desc');
    const logsSnapshot = await q.get();
    
    let logs: ProgressLog[] = [];
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
    return logs;
};

// HELPER FOR EFFICIENT DATA LOADING
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
        const projectData = doc.data();
        const createdAt = projectData.createdAt as FirebaseFirestore.Timestamp;
        const onHoldStartDate = projectData.onHoldStartDate as FirebaseFirestore.Timestamp;
        const onHoldEndDate = projectData.onHoldEndDate as FirebaseFirestore.Timestamp;
        projectsMap.set(doc.id, {
            id: doc.id,
            ...projectData,
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
            onHoldStartDate: onHoldStartDate ? onHoldStartDate.toDate().toISOString() : undefined,
            onHoldEndDate: onHoldEndDate ? onHoldEndDate.toDate().toISOString() : undefined,
            subProjects: [],
        } as FullProject);
    });

    const getStartDateFromPeriod = (period: string): Date | null => {
        try {
            const dateString = period.split(' - ')[0];
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    };
    
    const latestLogsMap = new Map<string, ProgressLog>();
    progressLogsSnapshot.docs.forEach(doc => {
        const logData = doc.data();
        
        // 核心修正：如果文件內容缺少 subProjectId 欄位，則嘗試從父路徑中提取 SID
        // 路徑結構為 projects/{pid}/sub_projects/{sid}/progress_logs/{lid}
        const sidFromPath = doc.ref.parent.parent?.id;
        const subProjectId = logData.subProjectId || sidFromPath;

        if (!subProjectId || !logData.reportingPeriod) return;

        const existingLog = latestLogsMap.get(subProjectId);
        
        const currentLogDate = getStartDateFromPeriod(logData.reportingPeriod);
        if (!currentLogDate) return;

        let shouldUpdate = false;
        if (!existingLog) {
            shouldUpdate = true;
        } else {
            const existingLogDate = getStartDateFromPeriod(existingLog.reportingPeriod);
            if (existingLogDate && currentLogDate > existingLogDate) {
                shouldUpdate = true;
            } else if (existingLogDate && currentLogDate.getTime() === existingLogDate.getTime()) {
                const currentUpdatedAt = (logData.updatedAt as FirebaseFirestore.Timestamp).toDate();
                const existingUpdatedAt = new Date(existingLog.updatedAt as string);
                if (currentUpdatedAt > existingUpdatedAt) {
                    shouldUpdate = true;
                }
            }
        }

        if (shouldUpdate) {
            const updatedAt = (logData.updatedAt as FirebaseFirestore.Timestamp);
            latestLogsMap.set(subProjectId, {
                ...logData,
                id: doc.id,
                subProjectId, // 確保回傳的物件中有 ID
                updatedAt: updatedAt.toDate().toISOString(),
                createdByName: userMap.get(logData.createdBy),
            } as ProgressLog);
        }
    });

    const allSubProjects: SubProjectWithLatestLog[] = [];
    subProjectsSnapshot.docs.forEach(subProjectDoc => {
        const subProjectData = subProjectDoc.data();
        const project = projectsMap.get(subProjectData.projectId);
        
        if (!project) {
            console.warn(`Sub-project ${subProjectDoc.id} is an orphan with invalid projectId ${subProjectData.projectId}.`);
            return;
        }

        const latestLog = latestLogsMap.get(subProjectDoc.id) || null;
        
        const subProjectIsOnHold = subProjectData.isOnHold ?? false;
        const parentProjectIsOnHold = project.isOnHold ?? false;

        let isOverdue = false;
        if (!subProjectIsOnHold && !parentProjectIsOnHold) {
            const sevenDaysAgo = subDays(new Date(), 7);
            isOverdue = latestLog?.updatedAt
                ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
                : true;
        }
        
        const expectedCompletionDate = subProjectData.expectedCompletionDate ? (subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
        const actualCompletionDate = subProjectData.actualCompletionDate ? (subProjectData.actualCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
        const createdAt = subProjectData.createdAt ? (subProjectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString();
        const onHoldStartDate = subProjectData.onHoldStartDate ? (subProjectData.onHoldStartDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
        const onHoldEndDate = subProjectData.onHoldEndDate ? (subProjectData.onHoldEndDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;

        const subProjectWithLog: SubProjectWithLatestLog = {
            ...subProjectData,
            id: subProjectDoc.id,
            expectedCompletionDate,
            actualCompletionDate,
            createdAt,
            onHoldStartDate,
            onHoldEndDate,
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
            isOnHold: subProjectIsOnHold,
            isParentOnHold: parentProjectIsOnHold,
        };
        
        allSubProjects.push(subProjectWithLog);
        project.subProjects.push(subProjectWithLog);
    });

    projectsMap.forEach(p => {
        p.subProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime())
    });

    const fullProjects = Array.from(projectsMap.values());
    
    return { allSubProjects, fullProjects };
}

export const getFullProjectById = async (projectId: string): Promise<FullProject | null> => {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
        return null;
    }
    
    const projectData = projectDoc.data()!;
    
    const [subProjectsSnapshot, users] = await Promise.all([
        projectDoc.ref.collection('sub_projects').orderBy('createdAt', 'asc').get(),
        getUsers()
    ]);
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const subProjectIds = subProjectsSnapshot.docs.map(doc => doc.id);
    const latestLogsMap = new Map<string, ProgressLog>();

    if (subProjectIds.length > 0) {
        const logPromises = subProjectIds.map(id => 
            db.collection(`projects/${projectId}/sub_projects/${id}/progress_logs`)
              .orderBy('updatedAt', 'desc')
              .limit(1)
              .get()
        );
        const logSnapshots = await Promise.all(logPromises);

        logSnapshots.forEach((logSnapshot, index) => {
            if (!logSnapshot.empty) {
                const doc = logSnapshot.docs[0];
                const logData = doc.data();
                const updatedAt = logData.updatedAt as FirebaseFirestore.Timestamp;
                latestLogsMap.set(subProjectIds[index], {
                    ...logData,
                    id: doc.id,
                    updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
                    createdByName: userMap.get(logData.createdBy),
                } as ProgressLog);
            }
        });
    }

    const subProjects: SubProjectWithLatestLog[] = subProjectsSnapshot.docs.map(doc => {
        const subProjectData = doc.data();
        const latestLog = latestLogsMap.get(doc.id) || null;

        const subProjectIsOnHold = subProjectData.isOnHold ?? false;
        const parentProjectIsOnHold = projectData.isOnHold ?? false;

        let isOverdue = false;
        if (!subProjectIsOnHold && !parentProjectIsOnHold) {
            const sevenDaysAgo = subDays(new Date(), 7);
            isOverdue = latestLog?.updatedAt ? new Date(latestLog.updatedAt as string) < sevenDaysAgo : true;
        }

        return {
            ...subProjectData,
            id: doc.id,
            expectedCompletionDate: subProjectData.expectedCompletionDate ? (subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            actualCompletionDate: subProjectData.actualCompletionDate ? (subProjectData.actualCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
            createdAt: subProjectData.createdAt ? (subProjectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString(),
            projectId: projectId,
            projectName: projectData.name,
            projectCaseNumber: projectData.caseNumber,
            projectPurpose: projectData.projectPurpose,
            currentStatusAndIssues: projectData.currentStatusAndIssues,
            yiehPhuiProjectManager: projectData.yiehPhuiProjectManager,
            tpmOfficeContact: projectData.tpmOfficeContact,
            egigaContact: projectData.egigaContact,
            ownerName: userMap.get(subProjectData.owner),
            latestLog,
            isOverdue,
            isOnHold: subProjectIsOnHold,
            isParentOnHold: parentProjectIsOnHold,
        } as SubProjectWithLatestLog;
    });

    const fullProject: FullProject = {
        id: projectDoc.id,
        ...projectData,
        createdAt: (projectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
        onHoldStartDate: projectData.onHoldStartDate ? (projectData.onHoldStartDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
        onHoldEndDate: projectData.onHoldEndDate ? (projectData.onHoldEndDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined,
        subProjects,
    } as FullProject;

    return JSON.parse(JSON.stringify(fullProject));
};

export const getFullProjects = async (): Promise<FullProject[]> => {
    const { fullProjects } = await getOptimizedProjectData();
    return JSON.parse(JSON.stringify(fullProjects));
};

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const { allSubProjects, fullProjects } = await getOptimizedProjectData();

    const projectOrderMap = new Map(fullProjects.map((p, i) => [p.id, i]));
    
    allSubProjects.sort((a, b) => {
        const orderA = projectOrderMap.get(a.projectId);
        const orderB = projectOrderMap.get(b.projectId);

        if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
            return orderA - orderB;
        }
        return new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime();
    });

    return allSubProjects;
};
