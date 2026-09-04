export type SeoLoopConfig = {
  enabled: boolean;
  executionEnabled: boolean;
  maxDailyProposals: number;
  maxDailyExecutions: number;
  maxTargetsPerProposal: number;
  lockTtlSeconds: number;
  gscDays: number;
  gscRowLimit: number;
};

function boolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function intEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getSeoLoopConfig(): SeoLoopConfig {
  return {
    enabled: boolEnv('SEO_LOOP_ENABLED', false),
    executionEnabled: boolEnv('SEO_LOOP_EXECUTION_ENABLED', false),
    maxDailyProposals: intEnv('SEO_LOOP_MAX_DAILY_PROPOSALS', 10),
    maxDailyExecutions: intEnv('SEO_LOOP_MAX_DAILY_EXECUTIONS', 3),
    maxTargetsPerProposal: intEnv('SEO_LOOP_MAX_TARGETS_PER_PROPOSAL', 3),
    lockTtlSeconds: intEnv('SEO_LOOP_LOCK_TTL_SECONDS', 240),
    gscDays: intEnv('SEO_LOOP_GSC_DAYS', 28),
    gscRowLimit: intEnv('SEO_LOOP_GSC_ROW_LIMIT', 50),
  };
}

export function requireCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
