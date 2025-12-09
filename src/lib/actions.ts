'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebaseOnServer } from '@/firebase/server-init';

const logSchema = z.object({
  executionSummary: z.string().min(1, '本週摘要為必填'),
  nextWeekPlan: z.string().min(1, '下週計畫為必填'),
  roadblocks: z.string().optional(),
  completionPercentage: z.coerce.number().min(0).max(100),
  reportingPeriod: z.string(),
  subProjectId: z.string(),
});

type State = {
  errors?: {
    [key: string]: string[] | undefined;
  };
  message?: string | null;
};

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


export async function addProgressLog(
  prevState: State,
  formData: FormData
): Promise<State> {
  const validatedFields = logSchema.safeParse({
    executionSummary: formData.get('executionSummary'),
    nextWeekPlan: formData.get('nextWeekPlan'),
    roadblocks: formData.get('roadblocks'),
    completionPercentage: formData.get('completionPercentage'),
    reportingPeriod: formData.get('reportingPeriod'),
    subProjectId: formData.get('subProjectId'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Add Log.',
    };
  }
  
  // Here you would call your database function, e.g.:
  // await db.collection(...).add({ ...validatedFields.data });
  console.log('Adding log (simulated):', validatedFields.data);

  revalidatePath('/dashboard');
  return { message: 'Progress log added successfully.' };
}

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
