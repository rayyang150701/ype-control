'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { db } from '@/lib/firebase-admin';
import type { User, ProgressLog } from '@/types';


const subProjectSchema = z.object({
    name: z.string().min(1, '子專案名稱為必填'),
    owner: z.string().min(1, '子專案負責人為必填'),
    expectedCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
    caseNumber: z.string().min(1, '主專案案號為必填'),
    name: z.string().min(1, '主專案名稱為必填'),
    subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
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
        createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(newProjectRef, newProjectData);

    data.subProjects.forEach(subProject => {
        const newSubProjectRef = db.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
        const newSubProjectData = {
            name: subProject.name,
            owner: subProject.owner,
            expectedCompletionDate: subProject.expectedCompletionDate ? Timestamp.fromDate(subProject.expectedCompletionDate) : null,
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

export async function addProgressLog (
    subProjectId: string, 
    logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<ProgressLog> {
    const userId = 'user-1'; 
    const projectsSnapshot = await db.collection('projects').get();
    let projectId: string | null = null;

    for (const projectDoc of projectsSnapshot.docs) {
        const subProjectCol = db.collection(`projects/${projectDoc.id}/sub_projects`);
        const subDocs = await subProjectCol.where('__name__', '==', subProjectId).limit(1).get();
        if(!subDocs.empty){
            projectId = projectDoc.id;
            break;
        }
    }

    if (!projectId) {
        throw new Error(`Could not find project for sub-project ID: ${subProjectId}`);
    }
    
    const newLogRef = db.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    
    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: FieldValue.serverTimestamp()
    };
    
    await newLogRef.set(newLogData);
    
    revalidatePath('/dashboard');

    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.uid, u.displayName]));

    return {
        id: newLogRef.id,
        ...logData,
        createdBy: userId,
        updatedAt: new Date(), 
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
    const projectsCol = db.collection('projects');
    const projectSnapshot = await projectsCol.get();
    
    let logs: ProgressLog[] = [];

    for (const projectDoc of projectSnapshot.docs) {
        const subProjectCol = db.collection(`projects/${projectDoc.id}/sub_projects`);
        const subProjectDocs = await subProjectCol.where('__name__', '==', subProjectId).limit(1).get();
        
        if (!subProjectDocs.empty) {
            const logsCol = db.collection(`projects/${projectDoc.id}/sub_projects/${subProjectId}/progress_logs`);
            const q = logsCol.orderBy('updatedAt', 'desc');
            const logsSnapshot = await q.get();
            
            if (!logsSnapshot.empty) {
                const users = await getUsers();
                const userMap = new Map(users.map(u => [u.uid, u.displayName]));
                logs = logsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const updatedAt = data.updatedAt as Timestamp;
                    return {
                        ...data,
                        id: doc.id,
                        updatedAt: updatedAt.toDate(),
                        createdByName: userMap.get(data.createdBy)
                    } as ProgressLog;
                });
            }
            break; 
        }
    }
    return logs;
};
