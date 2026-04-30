// @ts-nocheck
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog, UserRole, UserStatus, SubProject } from '@/types';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
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
        // Here you might want to add logic to check if the user is an owner of any sub-projects
        // before allowing deletion. For now, we'll proceed with deletion.
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
        await db.runTransaction(async (transaction: Transaction) => {
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
        revalidatePath('/projects'); // Assuming a project detail page might exist
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

export async function deleteSubProjects(projectId: string, subProjectIds: string[]) {
    if (!projectId || !subProjectIds || subProjectIds.length === 0) {
        throw new Error('Project ID and at least one Sub-project ID are required.');
    }

    const projectRef = db.collection('projects').doc(projectId);

    await db.runTransaction(async (transaction: Transaction) => {
        for (const subProjectId of subProjectIds) {
            const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
            
            // Delete all progress logs for the sub-project
            const progressLogsSnapshot = await subProjectRef.collection('progress_logs').get();
            progressLogsSnapshot.docs.forEach((logDoc: FirebaseFirestore.QueryDocumentSnapshot) => transaction.delete(logDoc.ref));
            
            // Delete the sub-project itself
            transaction.delete(subProjectRef);
        }
    });

    revalidatePath('/dashboard');
}

export async function deleteProject(projectId: string) {
    if (!projectId) {
        return { success: false, message: '缺少專案 ID' };
    }

    try {
        const projectRef = db.collection('projects').doc(projectId);
        const subProjectsSnapshot = await projectRef.collection('sub_projects').get();

        // Firestore transactions have a 500 write limit, so use batched deletes
        const batchSize = 400;
        let batch = db.batch();
        let opCount = 0;

        for (const subProjectDoc of subProjectsSnapshot.docs) {
            // Delete all progress logs for each sub-project
            const logsSnapshot = await subProjectDoc.ref.collection('progress_logs').get();
            for (const logDoc of logsSnapshot.docs) {
                batch.delete(logDoc.ref);
                opCount++;
                if (opCount >= batchSize) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
            // Delete the sub-project
            batch.delete(subProjectDoc.ref);
            opCount++;
            if (opCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        // Delete the project itself
        batch.delete(projectRef);
        await batch.commit();

        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功刪除' };
    } catch (error) {
        console.error('刪除專案失敗:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '刪除專案時發生未知錯誤',
        };
    }
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
  
      // Resume parent projects
      projectIds.forEach(pid => {
        const projectRef = db.collection('projects').doc(pid);
        batch.update(projectRef, { ...resumeUpdate, status: 'active' });
      });
  
      // Resume sub-projects
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


export const getFullProjectById = async (projectId: string): Promise<FullProject | null> => {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return null;
    }
    
    const projectData = projectDoc.data()! as Omit<Project, 'id' | 'createdAt'> & { createdAt: FirebaseFirestore.Timestamp, onHoldStartDate?: FirebaseFirestore.Timestamp, onHoldEndDate?: FirebaseFirestore.Timestamp };
    const project: Project = { 
        id: projectDoc.id, 
        ...projectData,
        createdAt: projectData.createdAt ? projectData.createdAt.toDate().toISOString() : new Date().toISOString(),
        onHoldStartDate: projectData.onHoldStartDate ? projectData.onHoldStartDate.toDate().toISOString() : undefined,
        onHoldEndDate: projectData.onHoldEndDate ? projectData.onHoldEndDate.toDate().toISOString() : undefined,
    };
  
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
        let latestLog: ProgressLog | null = null;
        if (logsSnapshot.docs.length > 0) {
            const logData = logsSnapshot.docs[0].data();
            const updatedAt = logData.updatedAt as FirebaseFirestore.Timestamp;
            latestLog = {
                ...logData,
                id: logsSnapshot.docs[0].id,
                updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
                createdByName: userMap.get(logData.createdBy),
            } as ProgressLog
        }
        
        const subProjectIsOnHold = subProjectData.isOnHold ?? false;
        const parentProjectIsOnHold = project.isOnHold ?? false;

        let isOverdue = false;
        if (!subProjectIsOnHold && !parentProjectIsOnHold) {
            const sevenDaysAgo = subDays(new Date(), 7);
            isOverdue = latestLog?.updatedAt
                ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
                : true;
        }

        const expectedCompletionDateTimestamp = subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp;
        const actualCompletionDateTimestamp = subProjectData.actualCompletionDate as FirebaseFirestore.Timestamp;
        const subProjectCreatedAtTimestamp = subProjectData.createdAt as FirebaseFirestore.Timestamp;

        subProjects.push({
            ...subProjectData,
            id: subProjectDoc.id,
            expectedCompletionDate: expectedCompletionDateTimestamp ? expectedCompletionDateTimestamp.toDate().toISOString() : undefined,
            actualCompletionDate: actualCompletionDateTimestamp ? actualCompletionDateTimestamp.toDate().toISOString() : undefined,
            createdAt: subProjectCreatedAtTimestamp ? subProjectCreatedAtTimestamp.toDate().toISOString() : new Date().toISOString(),
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
        } as SubProjectWithLatestLog);
    }
  
    const fullProject: FullProject = {
      ...project,
      subProjects: subProjects.sort((a,b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()),
    };

    return JSON.parse(JSON.stringify(fullProject));
};


export const getFullProjects = async (): Promise<FullProject[]> => {
    const projectsSnapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const fullProjects: FullProject[] = [];

    for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data() as Omit<Project, 'id' | 'createdAt'> & { createdAt: FirebaseFirestore.Timestamp, onHoldStartDate?: FirebaseFirestore.Timestamp, onHoldEndDate?: FirebaseFirestore.Timestamp };
        const project: Project = { 
            id: projectDoc.id, 
            ...projectData,
            createdAt: projectData.createdAt.toDate().toISOString(),
            onHoldStartDate: projectData.onHoldStartDate ? projectData.onHoldStartDate.toDate().toISOString() : undefined,
            onHoldEndDate: projectData.onHoldEndDate ? projectData.onHoldEndDate.toDate().toISOString() : undefined,
        };

        const subProjectsCol = projectDoc.ref.collection('sub_projects');
        const subProjectSnapshot = await subProjectsCol.orderBy('createdAt', 'asc').get();
        const subProjects: SubProjectWithLatestLog[] = [];

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProjectData = subProjectDoc.data();

            const logsCol = subProjectDoc.ref.collection('progress_logs');
            const logsQuery = logsCol.orderBy('updatedAt', 'desc').limit(1);
            const logsSnapshot = await logsQuery.get();
            
            let latestLog: ProgressLog | null = null;
            if (logsSnapshot.docs.length > 0) {
                const logData = logsSnapshot.docs[0].data();
                const updatedAt = logData.updatedAt as FirebaseFirestore.Timestamp;
                latestLog = {
                    ...logData,
                    id: logsSnapshot.docs[0].id,
                    updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
                    createdByName: userMap.get(logData.createdBy),
                } as ProgressLog;
            }

            const subProjectIsOnHold = subProjectData.isOnHold ?? false;
            const parentProjectIsOnHold = project.isOnHold ?? false;

            let isOverdue = false;
            if (!subProjectIsOnHold && !parentProjectIsOnHold) {
                const sevenDaysAgo = subDays(new Date(), 7);
                isOverdue = latestLog?.updatedAt ? new Date(latestLog.updatedAt) < sevenDaysAgo : true;
            }

            const expectedCompletionDate = subProjectData.expectedCompletionDate ? (subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
            const actualCompletionDate = subProjectData.actualCompletionDate ? (subProjectData.actualCompletionDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
            const createdAt = subProjectData.createdAt ? (subProjectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString() : new Date().toISOString();
            const onHoldStartDate = subProjectData.onHoldStartDate ? (subProjectData.onHoldStartDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;
            const onHoldEndDate = subProjectData.onHoldEndDate ? (subProjectData.onHoldEndDate as FirebaseFirestore.Timestamp).toDate().toISOString() : undefined;


            subProjects.push({
                ...subProjectData,
                id: subProjectDoc.id,
                projectId: project.id,
                projectName: project.name,
                projectCaseNumber: project.caseNumber,
                ownerName: userMap.get(subProjectData.owner),
                latestLog,
                isOverdue,
                isOnHold: subProjectIsOnHold,
                isParentOnHold: parentProjectIsOnHold,
                expectedCompletionDate,
                actualCompletionDate,
                createdAt,
                onHoldStartDate,
                onHoldEndDate,
            } as SubProjectWithLatestLog);
        }

        fullProjects.push({
            ...project,
            subProjects,
        });
    }

    return JSON.parse(JSON.stringify(fullProjects));
};


export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    const projectsCol = db.collection('projects');
    const projectsSnapshot = await projectsCol.orderBy('createdAt', 'desc').get();
    const projects = projectsSnapshot.docs.map(doc => {
        const data = doc.data() as Omit<Project, 'id' | 'createdAt'> & { createdAt: FirebaseFirestore.Timestamp };
        return { 
            id: doc.id, 
            ...data,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Project
    });

    const users = await getUsers();

    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    const allSubProjects: SubProjectWithLatestLog[] = [];

    for (const project of projects) {
        const subProjectsCol = db.collection(`projects/${project.id}/sub_projects`);
        const subProjectSnapshot = await subProjectsCol.orderBy('createdAt', 'asc').get();

        for (const subProjectDoc of subProjectSnapshot.docs) {
            const subProjectData = subProjectDoc.data();

            const logsCol = db.collection(`projects/${project.id}/sub_projects/${subProjectDoc.id}/progress_logs`);
            const logsQuery = logsCol.orderBy('updatedAt', 'desc').limit(1);

            const logsSnapshot = await logsQuery.get();
            let latestLog: ProgressLog | null = null;
            if (logsSnapshot.docs.length > 0) {
                 const logData = logsSnapshot.docs[0].data();
                 const updatedAt = logData.updatedAt as FirebaseFirestore.Timestamp;
                 latestLog = {
                    ...logData,
                    id: logsSnapshot.docs[0].id,
                    updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
                    createdByName: userMap.get(logData.createdBy),
                 } as ProgressLog;
            }
            
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


            allSubProjects.push({
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
            } as SubProjectWithLatestLog);
        }
    }
    return allSubProjects;
};
