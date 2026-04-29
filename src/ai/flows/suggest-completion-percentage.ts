'use server';

/**
 * @fileOverview An AI agent to suggest a completion percentage for a new progress log.
 *
 * - suggestCompletionPercentage - A function that suggests a completion percentage.
 * - SuggestCompletionPercentageInput - The input type for the suggestCompletionPercentage function.
 * - SuggestCompletionPercentageOutput - The return type for the suggestCompletionPercentage function.
 */

import { defineFlow } from 'genkit';
import { generate } from 'genkit/ai';
import { geminiPro } from '@genkit-ai/google-ai';
import { z } from 'zod';

const SuggestCompletionPercentageInputSchema = z.object({
  executionSummary: z.string().describe('The execution summary of the current week.'),
  nextWeekPlan: z.string().describe('The plan for the next week.'),
  previousCompletionPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe('The completion percentage of the previous week.'),
});
export type SuggestCompletionPercentageInput = z.infer<typeof SuggestCompletionPercentageInputSchema>;

const SuggestCompletionPercentageOutputSchema = z.object({
  suggestedCompletionPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe('The suggested completion percentage for the current week.'),
});
export type SuggestCompletionPercentageOutput = z.infer<typeof SuggestCompletionPercentageOutputSchema>;

export async function suggestCompletionPercentage(
  input: SuggestCompletionPercentageInput
): Promise<SuggestCompletionPercentageOutput> {
  return suggestCompletionPercentageFlow(input);
}

const PROMPT_TEMPLATE = `You are an AI assistant helping project managers estimate project completion percentages.

  Given the execution summary of the current week, the plan for the next week, and the previous completion percentage, suggest a reasonable completion percentage for the current week.

  Consider the following:
  - If the execution summary indicates significant progress and the next week plan is ambitious, increase the completion percentage accordingly.
  - If the execution summary indicates little progress and the next week plan is uncertain, maintain or slightly decrease the completion percentage.
  - Provide a completion percentage that is realistic and reflects the actual progress made.
  - It should be a number between 0 and 100.

  Previous Completion Percentage: {{{previousCompletionPercentage}}}
  Execution Summary: {{{executionSummary}}}
  Next Week Plan: {{{nextWeekPlan}}}

  Suggested Completion Percentage:`;

const suggestCompletionPercentageFlow = defineFlow(
  {
    name: 'suggestCompletionPercentageFlow',
    inputSchema: SuggestCompletionPercentageInputSchema,
    outputSchema: SuggestCompletionPercentageOutputSchema,
  },
  async input => {
    const response = await generate({
      model: geminiPro,
      prompt: PROMPT_TEMPLATE,
      input: input,
      output: {
        schema: SuggestCompletionPercentageOutputSchema,
      },
    });

    return response.output()!;
  }
);
