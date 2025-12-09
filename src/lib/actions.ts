'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

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
    id: z.string().optional(), // id will be present for existing sub-projects
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().optional(),
    expectedCompletionDate: z.date().optional(),
});

const editProjectSchema = z.object({
    caseNumber: z.string().min(1, '主專案案號為必填'),
    name: z.string().min(1, '主專案名稱為必填'),
    subProjects: z.array(editSubProjectSchema).min(1, '至少需要一個子專案'),
});

export async function createProject(data: z.infer<typeof projectSchema>) {
    const batch = db.batch();
    const userId = 'user-3'; // Dummy user ID

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

            // 1. Update the main project document
            transaction.update(projectRef, {
                caseNumber: data.caseNumber,
                name: data.name,
            });

            const currentSubProjectIds = data.subProjects.map(sp => sp.id).filter(id => id) as string[];
            
            // 2. Determine which sub-projects to delete
            const subProjectsToDelete = originalSubProjectIds.filter(id => !currentSubProjectIds.includes(id));
            
            for (const subProjectId of subProjectsToDelete) {
                const subProjectRef = projectRef.collection('sub_projects').doc(subProjectId);
                transaction.delete(subProjectRef);
            }

            // 3. Update existing sub-projects and add new ones
            for (const subProjectData of data.subProjects) {
                const subProjectRef = subProjectData.id 
                    ? projectRef.collection('sub_projects').doc(subProjectData.id)
                    : projectRef.collection('sub_projects').doc(); // New sub-project

                const dataToSet = {
                    name: subProjectData.name,
                    owner: subProjectData.owner ?? '',
                    expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                    projectId: projectId,
                    // Preserve createdAt for existing documents, set for new ones
                    createdAt: subProjectData.id ? FieldValue.serverTimestamp() : new Date(),
                };

                if (subProjectData.id) {
                    // This is an update, so we need to merge with existing data to preserve fields not in the form
                     transaction.update(subProjectRef, {
                        name: subProjectData.name,
                        owner: subProjectData.owner ?? '',
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                     });
                } else {
                    // This is a new document
                    transaction.set(subProjectRef, {
                        ...dataToSet.createdAt,
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
    const userId = 'user-1'; // Dummy user ID for who made the edit
    const projectId = await findProjectIdForSubProject(subProjectId);
  
    const logRef = db.doc(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs/${logId}`);
  
    const updateData = {
      ...logData,
      updatedAt: new Date(),
      // We don't update 'createdBy' on edit
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
