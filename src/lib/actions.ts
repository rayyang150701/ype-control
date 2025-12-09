'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { initializeFirebaseOnServer } from '@/firebase/server-init';
import type { User, ProgressLog } from '@/types';
import { collection, writeBatch, doc, serverTimestamp, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';


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
    const batch = writeBatch(firestore);

    // This is a placeholder for the current user's ID.
    // In a real application, you would get this from the authenticated user session.
    const userId = 'user-3'; // Assuming Charlie (Admin) is creating the project

    const newProjectRef = doc(collection(firestore, 'projects'));
    const newProjectData = {
        name: data.name,
        caseNumber: data.caseNumber,
        status: 'active',
        createdBy: userId,
        createdAt: serverTimestamp(),
    };
    batch.set(newProjectRef, newProjectData);

    data.subProjects.forEach(subProject => {
        const newSubProjectRef = doc(collection(firestore, `projects/${newProjectRef.id}/sub_projects`));
        const newSubProjectData = {
            name: subProject.name,
            owner: subProject.owner,
            expectedCompletionDate: subProject.expectedCompletionDate,
            projectId: newProjectRef.id,
            createdAt: serverTimestamp(),
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
    const { firestore } = await initializeFirebaseOnServer();

    // This is a placeholder for the current user's ID.
    // In a real application, you would get this from the authenticated user session.
    const userId = 'user-1'; 

    const projectsSnapshot = await getDocs(collection(firestore, 'projects'));
    let projectId: string | null = null;

    // This is inefficient, but necessary without changing the data model.
    // A better model would have subprojects in a root collection with a projectId field.
    for (const projectDoc of projectsSnapshot.docs) {
        const subProjectDocRef = doc(firestore, `projects/${projectDoc.id}/sub_projects/${subProjectId}`);
        // We can't query for a document, so we have to try to get it. A full query would be better.
        // This will error if the doc doesn't exist, which isn't ideal for a search.
        // For this app's scale, iterating is acceptable.
        if (projectDoc.id) { // A simplified check; in reality, you might need getDoc
             const subProjectCol = collection(firestore, `projects/${projectDoc.id}/sub_projects`);
             const subDocs = await getDocs(subProjectCol);
             if(subDocs.docs.some(d => d.id === subProjectId)){
                projectId = projectDoc.id;
                break;
             }
        }
    }

    if (!projectId) {
        throw new Error(`Could not find project for sub-project ID: ${subProjectId}`);
    }
    
    const newLogRef = doc(collection(firestore, `projects/${projectId}/sub_projects/${subProjectId}/progress_logs`));
    
    const newLogData = {
        ...logData,
        subProjectId,
        createdBy: userId,
        updatedAt: serverTimestamp()
    };
    
    await writeBatch(firestore).set(newLogRef, newLogData).commit();
    
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
    // Here you would implement the logic to delete the project from Firestore
    console.log(`(Simulated) Deleting project with ID: ${projectId}`);
    
    // After deletion, revalidate the path to update the UI
    revalidatePath('/dashboard');
    
    return { message: `Project ${projectId} deleted successfully.` };
}

export const getUsers = async (): Promise<User[]> => {
  const { firestore } = await initializeFirebaseOnServer();
  const usersCol = collection(firestore, 'users');
  const userSnapshot = await getDocs(usersCol);
  const userList = userSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
  return userList;
}

export const getProgressLogsForSubProject = async (subProjectId: string): Promise<ProgressLog[]> => {
    const { firestore } = await initializeFirebaseOnServer();
    const projectsCol = collection(firestore, 'projects');
    const projectSnapshot = await getDocs(projectsCol);
    
    let logs: ProgressLog[] = [];

    for (const projectDoc of projectSnapshot.docs) {
        const subProjectCol = collection(firestore, `projects/${projectDoc.id}/sub_projects`);
        const subProjectDocs = await getDocs(subProjectCol);
        
        if (subProjectDocs.docs.some(d => d.id === subProjectId)) {
            const logsCol = collection(firestore, `projects/${projectDoc.id}/sub_projects/${subProjectId}/progress_logs`);
            const q = query(logsCol, orderBy('updatedAt', 'desc'));
            const logsSnapshot = await getDocs(q);
            
            if (!logsSnapshot.empty) {
                const users = await getUsers();
                const userMap = new Map(users.map(u => [u.uid, u.displayName]));
                logs = logsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        updatedAt: (data.updatedAt as Timestamp).toDate(),
                        createdByName: userMap.get(data.createdBy)
                    } as ProgressLog;
                });
            }
            break; // Found the logs for the subproject
        }
    }
    return logs;
};
