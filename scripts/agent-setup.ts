/**
 * AI エージェント: 高校ページ設定の一括自動化 CLI
 *
 * 使い方:
 *   npx tsx scripts/agent-setup.ts --all --publish=false
 *   npx tsx scripts/agent-setup.ts --all --steps=prefecture
 *   npx tsx scripts/agent-setup.ts --school-id=xxx --publish=true
 *   npx tsx scripts/agent-setup.ts --all --dry-run
 *   npx tsx scripts/agent-setup.ts --all --delta=10
 *   npx tsx scripts/agent-setup.ts --all --sleep-ms=300
 *   npx tsx scripts/agent-setup.ts --all --steps=intro --intro-missing-only --publish=false
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// --- 引数パース ---

interface CliArgs {
  all: boolean;
  schoolId: string | null;
  steps: string[];
  publish: boolean;
  dryRun: boolean;
  delta: number;
  limit: number;
  baseUrl: string;
  /** 各校処理のあとに API へ送る間隔（ms）。レート制限対策 */
  sleepMs: number;
  /** schools.intro が null / 空の校のみバッチ対象（再実行時の無駄往復削減） */
  introMissingOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    all: false,
    schoolId: null,
    steps: ['prefecture', 'slug', 'intro', 'summary', 'meta', 'seo_sections', 'faq', 'review_tendency'],
    publish: true,
    dryRun: false,
    delta: 5,
    limit: 10,
    baseUrl: process.env.AGENT_BASE_URL || 'http://localhost:3000/tsushin-kuchikomi',
    sleepMs: 0,
    introMissingOnly: false,
  };

  for (const arg of args) {
    if (arg === '--all') {
      parsed.all = true;
    } else if (arg.startsWith('--school-id=')) {
      parsed.schoolId = arg.split('=')[1];
    } else if (arg.startsWith('--steps=')) {
      parsed.steps = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--publish=')) {
      parsed.publish = arg.split('=')[1] === 'true';
    } else if (arg === '--publish') {
      parsed.publish = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg.startsWith('--delta=')) {
      parsed.delta = parseInt(arg.split('=')[1], 10) || 5;
    } else if (arg.startsWith('--limit=')) {
      parsed.limit = parseInt(arg.split('=')[1], 10) || 10;
    } else if (arg.startsWith('--base-url=')) {
      parsed.baseUrl = arg.split('=')[1];
    } else if (arg.startsWith('--sleep-ms=')) {
      parsed.sleepMs = parseInt(arg.split('=')[1], 10) || 0;
    } else if (arg === '--intro-missing-only') {
      parsed.introMissingOnly = true;
    }
  }

  return parsed;
}

// --- API 呼び出し ---

function getApiKey(): string {
  const key = process.env.AGENT_API_KEY;
  if (!key) {
    console.error('ERROR: AGENT_API_KEY が環境変数に設定されていません');
    console.error('.env.local に AGENT_API_KEY=<your-secret-key> を追加してください');
    process.exit(1);
  }
  return key;
}

async function callSetupApi(
  baseUrl: string,
  apiKey: string,
  schoolId: string,
  options: { steps: string[]; publish: boolean; dryRun: boolean; delta: number }
): Promise<any> {
  const url = `${baseUrl}/api/admin/agent/schools/${schoolId}/setup`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      steps: options.steps,
      publish: options.publish,
      dry_run: options.dryRun,
      review_delta_threshold: options.delta,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

async function callBatchApi(
  baseUrl: string,
  apiKey: string,
  options: {
    steps: string[];
    publish: boolean;
    dryRun: boolean;
    delta: number;
    limit: number;
    offset: number;
    sleepMs: number;
    filter?: Record<string, string | boolean>;
  }
): Promise<any> {
  const url = `${baseUrl}/api/admin/agent/schools/batch-setup`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      filter: options.filter || { status: 'active' },
      steps: options.steps,
      publish: options.publish,
      dry_run: options.dryRun,
      review_delta_threshold: options.delta,
      limit: options.limit,
      offset: options.offset,
      sleep_ms: options.sleepMs,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Batch API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// --- 表示 ---

interface SchoolResult {
  school_id: string;
  school_name: string;
  review_count?: number;
  review_delta?: number;
  results?: Record<string, { status: string; reason?: string; value?: string; [key: string]: unknown }>;
  alerts?: Array<{ code: string; message: string; severity: string }>;
  tokens_used?: { openai: number; perplexity: number };
  error?: string;
}

function formatStepResult(step: string, result: { status: string; reason?: string; value?: string; [key: string]: unknown }): string {
  const label = step.padEnd(16);
  if (result.status === 'skipped') {
    const reason = result.reason || '';
    const val = result.value ? ` (${result.value})` : '';
    return `  ${label} SKIP (${reason}${val})`;
  }
  if (result.status === 'error') {
    return `  ${label} ERROR: ${result.reason || 'unknown'}`;
  }
  const details: string[] = [];
  if (result.value) details.push(result.value as string);
  if (result.confidence) details.push(`confidence: ${result.confidence}`);
  if (result.meta_title_length) details.push(`title: ${result.meta_title_length}字`);
  if (result.meta_description_length) details.push(`desc: ${result.meta_description_length}字`);
  if (result.sections_count) details.push(`${result.sections_count} sections`);
  if (result.items_count) details.push(`${result.items_count} items`);
  if (result.review_delta !== undefined) details.push(`delta=${result.review_delta}`);
  if (result.citations) details.push(`citations: ${(result.citations as string[]).length}`);
  return `  ${label} OK${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
}

function printSchoolResult(index: number, total: number, result: SchoolResult): void {
  const reviewInfo = result.review_count !== undefined ? ` (reviews: ${result.review_count})` : '';
  console.log(`\n[${index + 1}/${total}] ${result.school_name}${reviewInfo}`);

  if (result.error) {
    console.log(`  ERROR: ${result.error}`);
    return;
  }

  if (result.results) {
    for (const [step, stepResult] of Object.entries(result.results)) {
      console.log(formatStepResult(step, stepResult));
    }
  }

  if (result.alerts && result.alerts.length > 0) {
    for (const alert of result.alerts) {
      console.log(`  [${alert.code}] ${alert.message}`);
    }
  }

  if (result.tokens_used) {
    const parts: string[] = [];
    if (result.tokens_used.openai > 0) parts.push(`OpenAI: ${result.tokens_used.openai.toLocaleString()}`);
    if (result.tokens_used.perplexity > 0) parts.push(`Perplexity: ${result.tokens_used.perplexity.toLocaleString()}`);
    if (parts.length > 0) {
      console.log(`  → ${parts.join(' | ')} tokens`);
    }
  }
}

function printSummary(
  allResults: SchoolResult[],
  totalSchools: number,
  startTime: number
): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  let processed = 0;
  let skippedNoReviews = 0;
  let skippedNoChanges = 0;
  let errors = 0;
  let totalOpenAI = 0;
  let totalPerplexity = 0;
  const alertCounts: Record<string, number> = {};

  for (const r of allResults) {
    if (r.error) {
      errors++;
      continue;
    }
    const steps = Object.values(r.results || {});
    const allSkipped = steps.every((s) => s.status === 'skipped');
    if (allSkipped) {
      if (r.review_count === 0) {
        skippedNoReviews++;
      } else {
        skippedNoChanges++;
      }
    } else {
      processed++;
    }
    totalOpenAI += r.tokens_used?.openai || 0;
    totalPerplexity += r.tokens_used?.perplexity || 0;
    for (const alert of r.alerts || []) {
      alertCounts[alert.code] = (alertCounts[alert.code] || 0) + 1;
    }
  }

  const openaiCost = (totalOpenAI / 1_000_000) * 2.5;
  const perplexityCost = (totalPerplexity / 1_000_000) * 1;

  console.log('\n' + '='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Total: ${totalSchools} schools (${elapsed}s)`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (no reviews): ${skippedNoReviews}`);
  console.log(`  Skipped (no changes): ${skippedNoChanges}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);
  console.log(`Tokens: OpenAI ${totalOpenAI.toLocaleString()} (~$${openaiCost.toFixed(3)}) | Perplexity ${totalPerplexity.toLocaleString()} (~$${perplexityCost.toFixed(4)})`);

  const alertEntries = Object.entries(alertCounts);
  if (alertEntries.length > 0) {
    const totalAlerts = alertEntries.reduce((sum, [, count]) => sum + count, 0);
    console.log(`\nAlerts (${totalAlerts})`);
    for (const [code, count] of alertEntries.sort()) {
      console.log(`  ${code}: ${count} school${count > 1 ? 's' : ''}`);
    }
  }
}

function saveLog(allResults: SchoolResult[], args: CliArgs): string {
  const date = new Date().toISOString().slice(0, 10);
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `agent-setup-${date}.json`);

  const logData = {
    timestamp: new Date().toISOString(),
    args,
    results: allResults,
  };

  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
  return logPath;
}

// --- メイン ---

async function main() {
  const args = parseArgs();
  const apiKey = getApiKey();

  console.log('='.repeat(50));
  console.log('AI Agent Setup');
  console.log('='.repeat(50));
  console.log(`Mode: ${args.all ? 'all schools' : `school ${args.schoolId}`}`);
  console.log(`Steps: ${args.steps.join(', ')}`);
  console.log(`Publish: ${args.publish} | Dry run: ${args.dryRun} | Delta: ${args.delta} | Sleep: ${args.sleepMs}ms`);
  if (args.introMissingOnly) {
    console.log('Filter: intro 未設定の校のみ（batch-setup intro_missing）');
  }
  console.log(`Base URL: ${args.baseUrl}`);

  if (!args.all && !args.schoolId) {
    console.error('\nERROR: --all または --school-id=xxx を指定してください');
    process.exit(1);
  }

  const startTime = Date.now();
  const allResults: SchoolResult[] = [];

  if (args.schoolId) {
    console.log(`\n単一学校モード: ${args.schoolId}`);
    try {
      const result = await callSetupApi(args.baseUrl, apiKey, args.schoolId, {
        steps: args.steps,
        publish: args.publish,
        dryRun: args.dryRun,
        delta: args.delta,
      });
      allResults.push(result);
      printSchoolResult(0, 1, result);
    } catch (e) {
      console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      allResults.push({ school_id: args.schoolId, school_name: 'unknown', error: String(e) });
    }
    printSummary(allResults, 1, startTime);
  } else {
    let offset = 0;
    let totalSchools = 0;
    let batchIndex = 0;

    while (true) {
      try {
        const batchFilter: Record<string, string | boolean> = { status: 'active' };
        if (args.introMissingOnly) {
          batchFilter.intro_missing = true;
        }

        const batchResult = await callBatchApi(args.baseUrl, apiKey, {
          steps: args.steps,
          publish: args.publish,
          dryRun: args.dryRun,
          delta: args.delta,
          limit: args.limit,
          offset,
          sleepMs: args.sleepMs,
          filter: batchFilter,
        });

        if (batchIndex === 0) {
          totalSchools = batchResult.total || 0;
          console.log(`\n全校モード: ${totalSchools} schools`);
        }

        const batchResults: SchoolResult[] = batchResult.results || [];
        for (let i = 0; i < batchResults.length; i++) {
          allResults.push(batchResults[i]);
          printSchoolResult(offset + i, totalSchools, batchResults[i]);
        }

        if (batchResults.length < args.limit || offset + batchResults.length >= totalSchools) {
          break;
        }

        offset += args.limit;
        batchIndex++;
      } catch (e) {
        console.error(`\nBatch error at offset ${offset}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }

    printSummary(allResults, totalSchools, startTime);
  }

  const logPath = saveLog(allResults, args);
  console.log(`\nDetails: ${logPath}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
