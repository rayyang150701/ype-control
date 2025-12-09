'use server';

/**
 * @fileOverview Implements the smart roadblock carry-forward logic for new progress logs.
 *
 * This file exports:
 * - `smartRoadblockCarryForward`: An async function that determines whether to carry forward
 *   roadblocks from the previous progress log based on keywords in the execution summary and next week plan.
 * - `SmartRoadblockCarryForwardInput`: The input type for the smartRoadblockCarryForward function.
 * - `SmartRoadblockCarryForwardOutput`: The return type for the smartRoadblockCarryForward function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SmartRoadblockCarryForwardInputSchema = z.object({
  previousRoadblocks: z.string().optional().describe('Roadblocks from the previous progress log.'),
  executionSummary: z.string().describe('Execution summary of the current progress log.'),
  nextWeekPlan: z.string().describe('Next week plan of the current progress log.'),
});
export type SmartRoadblockCarryForwardInput = z.infer<typeof SmartRoadblockCarryForwardInputSchema>;

const SmartRoadblockCarryForwardOutputSchema = z.object({
  carryForwardRoadblocks: z
    .boolean()
    .describe('Whether to carry forward the roadblocks from the previous progress log.'),
});
export type SmartRoadblockCarryForwardOutput = z.infer<typeof SmartRoadblockCarryForwardOutputSchema>;

const carryForwardKeywords = ['未解決', '卡住', '待確認', '延遲', '問題', 'unresolved', 'stuck', 'pending confirmation', 'delayed'];

export async function smartRoadblockCarryForward(
  input: SmartRoadblockCarryForwardInput
): Promise<SmartRoadblockCarryForwardOutput> {
  return smartRoadblockCarryForwardFlow(input);
}

const smartRoadblockCarryForwardPrompt = ai.definePrompt({
  name: 'smartRoadblockCarryForwardPrompt',
  input: { schema: SmartRoadblockCarryForwardInputSchema },
  output: { schema: SmartRoadblockCarryForwardOutputSchema },
  prompt: `Determine whether to carry forward the roadblocks from the previous week's progress log based on the following information.

Previous Roadblocks: {{previousRoadblocks}}
Execution Summary: {{executionSummary}}
Next Week Plan: {{nextWeekPlan}}

Carry forward the roadblocks if the execution summary or next week plan contains any of the following keywords: ${carryForwardKeywords.join(', ')}.

Return true if the roadblocks should be carried forward, and false otherwise.`,
});

const smartRoadblockCarryForwardFlow = ai.defineFlow(
  {
    name: 'smartRoadblockCarryForwardFlow',
    inputSchema: SmartRoadblockCarryForwardInputSchema,
    outputSchema: SmartRoadblockCarryForwardOutputSchema,
  },
  async input => {
    if (!input.previousRoadblocks) {
      return { carryForwardRoadblocks: false };
    }

    const shouldCarryForward = carryForwardKeywords.some(
      keyword =>
        input.executionSummary.includes(keyword) || input.nextWeekPlan.includes(keyword)
    );

    return { carryForwardRoadblocks: shouldCarryForward };
  }
);
