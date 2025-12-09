'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { initializeFirebaseOnServer } from '@/firebase/server-init';
import type { User, ProgressLog } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


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
    const { firestore } = await initializeFirebaseOnServer();
    const batch = firestore.batch();

    const userId = 'user-3'; // Dummy user ID

    const newProjectRef = firestore.collection('projects').doc();
    const newProjectData = {
        name: data.name,
        caseNumber: data.caseNumber,
        status: 'active',
        createdBy: userId,
        createdAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(newProjectRef, newProjectData);

    const subProjectWrites = data.subProjects.map(subProject => {
        const newSubProjectRef = firestore.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
        const newSubProjectData = {
            name: subProject.name,
            owner: subProject.owner,
            expectedCompletionDate: subProject.expectedCompletionDate,
            projectId: newProjectRef.id,
            createdAt: firestore.FieldValue.serverTimestamp(),
        };
        batch.set(newSubProjectRef, newSubProjectData);
        return { ref: newSubProjectRef, data: newSubProjectData };
    });

    return batch.commit().then(() => {
        revalidatePath('/dashboard');
        return { success: true, message: '專案已成功建立！' };
    }).catch(error => {
        console.error("Error creating project:", error);
        
        // Create and emit a detailed permission error
        const permissionError = new FirestorePermissionError({
            path: `projects/${newProjectRef.id}`, // Representative path
            operation: 'write', // Batch write operation
            requestResourceData: { 
                project: newProjectData, 
                subProjects: subProjectWrites.map(w => w.data) 
            },
        });
        errorEmitter.emit('permission-error', permissionError);

        // Return a failure message to the client
        return { success: false, message: '建立專案時發生錯誤。' };
    });
}

export async function addProgressLog (
    subProjectId: string, 
    logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<ProgressLog> {
    const { firestore } = await initializeFirebaseOnServer();

    const userId = 'user-1'; 

    const projectsSnapshot = await firestore.collection('projects').get();
    let projectId: string | null = null;

    for (const projectDoc of projectsSnapshot.docs) {
        const subProjectCol = firestore.collection(`projects/${projectDoc.id}/sub_projects`);
        const subDocs = await subProjectCol.get();
        if(subDocs.docs.some(d => d.id === subProjectId)){
            projectId = projectDoc.id;
            break;
        }
    }

    if (!projectId) {
        throw new Error(`Could not find project for sub-project ID: ${subProjectId}`);
    }
    
    const newLogRef = firestore.collection(`projects/${projectId}/sub_projects/${subProjectId}/progress_logs`).doc();
    
    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: firestore.FieldValue.serverTimestamp()
    };
    
    const batch = firestore.batch();
    batch.set(newLogRef, newLogData);
    await batch.commit();
    
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
  const { firestore } = await initializeFirebaseOnServer();
  const usersCol = firestore.collection('users');
  const userSnapshot = await usersCol.get();
  const userList = userSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
  return userList;
}

export const getProgressLogsForSubProject = async (subProjectId: string): Promise<ProgressLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    const projectsCol = firestore.collection('projects');
    const projectSnapshot = await projectsCol.get();
    
    let logs: ProgressLog[] = [];

    for (const projectDoc of projectSnapshot.docs) {
        const subProjectCol = firestore.collection(`projects/${projectDoc.id}/sub_projects`);
        const subProjectDocs = await subProjectCol.get();
        
        if (subProjectDocs.docs.some(d => d.id === subProjectId)) {
            const logsCol = firestore.collection(`projects/${projectDoc.id}/sub_projects/${subProjectId}/progress_logs`);
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
