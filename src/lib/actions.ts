'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog, FullProject, Project, SubProjectWithLatestLog } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { format, differenceInDays, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';


// Schema definitions

const subProjectSchema = z.object({
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().min(1, '必須選擇一位負責人'),
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
  owner: z.string().min(1, '必須選擇一位負責人'),
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
            owner: subProject.owner,
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
                        owner: subProjectData.owner,
                        expectedCompletionDate: subProjectData.expectedCompletionDate ?? null,
                     });
                } else {
                    transaction.set(subProjectRef, {
                         name: subProjectData.name,
                        owner: subProjectData.owner,
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

// Data fetching functions

export const getUsers = async (): Promise<User[]> => {
  const usersCol = db.collection('users');
  const userSnapshot = await usersCol.get();
  const userList = userSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      uid: doc.id,
      createdAt: (data.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
    } as User;
  });
  return userList;
};

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
    
    const projectData = projectDoc.data()!;
    const project: Project = { 
        id: projectDoc.id, 
        ...projectData,
        createdAt: (projectData.createdAt as FirebaseFirestore.Timestamp).toDate().toISOString()
    } as Project;
  
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
        let latestLog = null;
        if (logsSnapshot.docs.length > 0) {
            const logData = logsSnapshot.docs[0].data();
            latestLog = {
                ...logData,
                id: logsSnapshot.docs[0].id,
                updatedAt: (logData.updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
                createdByName: userMap.get(logData.createdBy),
            } as ProgressLog
        }

        const sevenDaysAgo = subDays(new Date(), 7);
        const isOverdue = latestLog?.updatedAt
            ? new Date(latestLog.updatedAt as string) < sevenDaysAgo
            : true;

        const expectedCompletionDateTimestamp = subProjectData.expectedCompletionDate as FirebaseFirestore.Timestamp;
        const createdAtTimestamp = subProjectData.createdAt as FirebaseFirestore.Timestamp;

        subProjects.push({
            ...subProjectData,
            id: subProjectDoc.id,
            expectedCompletionDate: expectedCompletionDateTimestamp ? expectedCompletionDateTimestamp.toDate().toISOString() : new Date().toISOString(),
            createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
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

    const users = await getUsers();

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
            let latestLog = null;
            if (logsSnapshot.docs.length > 0) {
                 const logData = logsSnapshot.docs[0].data();
                 latestLog = {
                    ...logData,
                    id: logsSnapshot.docs[0].id,
                    updatedAt: (logData.updatedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
                    createdByName: userMap.get(logData.createdBy),
                 } as ProgressLog;
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
