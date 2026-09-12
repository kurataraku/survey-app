import { z } from 'zod';

export const analysisFactSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['gsc', 'html', 'database']),
  statement: z.string().min(1),
});

export type AnalysisFact = z.infer<typeof analysisFactSchema>;

export const analystOutputSchema = z
  .object({
    sufficient: z.boolean(),
    selectedFactIds: z.array(z.string().min(1)),
    hypotheses: z.array(z.string().min(1)),
    missingInformation: z.array(z.string().min(1)),
    diagnosis: z.string().min(1).nullable(),
    targetMetric: z.enum(['clicks', 'impressions', 'ctr', 'position']).nullable(),
    confidence: z.number().min(0).max(1),
  })
  .superRefine((value, ctx) => {
    if (!value.sufficient) return;
    if (value.selectedFactIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['selectedFactIds'],
        message: 'sufficient=trueには実測Factが必要です',
      });
    }
    if (!value.diagnosis) {
      ctx.addIssue({
        code: 'custom',
        path: ['diagnosis'],
        message: 'sufficient=trueにはdiagnosisが必要です',
      });
    }
    if (!value.targetMetric) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetMetric'],
        message: 'sufficient=trueにはtargetMetricが必要です',
      });
    }
  });

export type AnalystOutput = z.infer<typeof analystOutputSchema>;

export type AnalysisStage = 'analyst' | 'strategist';

export type StructuredAttempt<T> = {
  attempt: number;
  inputSnapshot: unknown;
  inputHash: string;
  rawOutput: string | null;
  parsedOutput: T | null;
  status: 'succeeded' | 'invalid_output' | 'call_failed';
  error: string | null;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
};
