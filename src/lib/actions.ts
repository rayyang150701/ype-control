'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { suggestCompletionPercentage } from '@/ai/flows/suggest-completion-percentage';
import { smartRoadblockCarryForward } from '@/ai/flows/smart-roadblock-carry-forward';

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
