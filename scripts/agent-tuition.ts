/**
 * AI エージェント: 学費目安の一括抽出 CLI
 *
 * 公式URL（schools.official_url）を起点に学費情報を抽出し、draft として保存する。
 * 自動公開はしない（管理画面の「学費目安」タブで人間が確認してから公開する）。
 * official_url 未登録の学校はデフォルトでスキップする（--use-perplexity 指定時のみURL特定を試みる）。
 *
 * 使い方:
 *   npx tsx scripts/agent-tuition.ts --school-id=xxx
 *   npx tsx scripts/agent-tuition.ts --school-id=xxx --tuition-url=https://example.ac.jp/tuition/
 *   npx tsx scripts/agent-tuition.ts --prefecture=東京都 --limit=20
 *   npx tsx scripts/agent-tuition.ts --prefecture=東京都 --limit=20 --order=reviews
 *   npx tsx scripts/agent-tuition.ts --prefecture=東京都 --dry-run
 *   npx tsx scripts/agent-tuition.ts --prefecture=東京都 --use-perplexity
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// --- 引数パース ---

interface CliArgs {
  schoolId: string | null;
  tuitionUrl: string | null;
  prefecture: string | null;
  limit: number;
  order: 'reviews' | 'name';
  usePerplexity: boolean;
  dryRun: boolean;
  sleepMs: number;
  baseUrl: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    schoolId: null,
    tuitionUrl: null,
    prefecture: null,
    limit: 20,
    order: 'reviews',
    usePerplexity: false,
    dryRun: false,
    sleepMs: 1000,
    baseUrl: process.env.AGENT_BASE_URL || 'http://localhost:3000/tsushin-kuchikomi',
  };

  for (const arg of args) {
    if (arg.startsWith('--school-id=')) {
      parsed.schoolId = arg.split('=')[1];
    } else if (arg.startsWith('--tuition-url=')) {
      parsed.tuitionUrl = arg.slice('--tuition-url='.length);
    } else if (arg.startsWith('--prefecture=')) {
      parsed.prefecture = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      parsed.limit = parseInt(arg.split('=')[1], 10) || 20;
    } else if (arg.startsWith('--order=')) {
      parsed.order = arg.split('=')[1] === 'name' ? 'name' : 'reviews';
    } else if (arg === '--use-perplexity') {
      parsed.usePerplexity = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg.startsWith('--sleep-ms=')) {
      parsed.sleepMs = parseInt(arg.split('=')[1], 10) || 0;
    } else if (arg.startsWith('--base-url=')) {
      parsed.baseUrl = arg.split('=')[1];
    }
  }

  return parsed;
}

function getApiKey(): string {
  const key = process.env.AGENT_API_KEY;
  if (!key) {
    console.error('ERROR: AGENT_API_KEY が環境変数に設定されていません');
    console.error('.env.local に AGENT_API_KEY=<your-secret-key> を追加してください');
    process.exit(1);
  }
  return key;
}

// --- 対象学校の取得 ---

interface TargetSchool {
  id: string;
  name: string;
  official_url: string | null;
  review_count: number;
}

async function fetchTargetSchools(args: CliArgs): Promise<TargetSchool[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  let query = supabase
    .from('schools')
    .select('id, name, official_url')
    .eq('status', 'active')
    .eq('is_public', true);

  if (args.prefecture) {
    query = query.or(`prefecture.eq.${args.prefecture},prefectures.cs.{${args.prefecture}}`);
  }

  const { data: schools, error } = await query;
  if (error) {
    console.error('ERROR: 学校一覧の取得に失敗しました:', error.message);
    process.exit(1);
  }
  if (!schools || schools.length === 0) return [];

  // 口コミ件数を集計（口コミ上位校を優先するため）
  const ids = schools.map((s) => s.id);
  const counts = new Map<string, number>();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data: rows } = await supabase
      .from('survey_responses')
      .select('school_id')
      .in('school_id', chunk)
      .eq('is_public', true);
    for (const row of rows || []) {
      counts.set(row.school_id, (counts.get(row.school_id) || 0) + 1);
    }
  }

  const targets: TargetSchool[] = schools.map((s) => ({
    id: s.id,
    name: s.name,
    official_url: s.official_url ?? null,
    review_count: counts.get(s.id) || 0,
  }));

  if (args.order === 'reviews') {
    targets.sort((a, b) => b.review_count - a.review_count);
  } else {
    targets.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  return targets.slice(0, args.limit);
}

// --- extract API 呼び出し ---

interface ExtractResult {
  school_id: string;
  school_name: string;
  status: 'ok' | 'skipped' | 'error';
  detail: string;
  warnings: string[];
  tokens: number;
}

async function callExtractApi(
  args: CliArgs,
  apiKey: string,
  school: TargetSchool
): Promise<ExtractResult> {
  const url = `${args.baseUrl}/api/admin/schools/${school.id}/tuition/extract`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      tuitionPageUrl: args.tuitionUrl || undefined,
      usePerplexity: args.usePerplexity,
      dryRun: args.dryRun,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      school_id: school.id,
      school_name: school.name,
      status: 'error',
      detail: body.message || body.error || `HTTP ${response.status}`,
      warnings: [],
      tokens: 0,
    };
  }

  if (body.skipped) {
    return {
      school_id: school.id,
      school_name: school.name,
      status: 'skipped',
      detail: body.reason || 'skipped',
      warnings: [],
      tokens: 0,
    };
  }

  const found = body.found_tuition_info ?? body.extraction?.foundTuitionInfo;
  const warnings: string[] = body.warnings || body.extraction?.warnings || [];
  const tokens = body.tokens_used?.total ?? body.extraction?.tokensUsed?.total ?? 0;

  return {
    school_id: school.id,
    school_name: school.name,
    status: 'ok',
    detail: args.dryRun
      ? `dry-run（金額${found ? 'あり' : 'なし'}）`
      : found
        ? '金額を抽出して draft 保存（要確認）'
        : '金額未確認 → contact_required の draft 保存（要確認）',
    warnings,
    tokens,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveLog(results: ExtractResult[], args: CliArgs): string {
  const date = new Date().toISOString().slice(0, 10);
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `agent-tuition-${date}.json`);
  fs.writeFileSync(
    logPath,
    JSON.stringify({ timestamp: new Date().toISOString(), args, results }, null, 2),
    'utf-8'
  );
  return logPath;
}

// --- メイン ---

async function main() {
  const args = parseArgs();
  const apiKey = getApiKey();

  console.log('='.repeat(50));
  console.log('AI Agent: 学費目安抽出');
  console.log('='.repeat(50));
  console.log(`Mode: ${args.schoolId ? `school ${args.schoolId}` : `prefecture=${args.prefecture || '(全国)'} limit=${args.limit} order=${args.order}`}`);
  console.log(`Perplexityフォールバック: ${args.usePerplexity ? '有効' : '無効（official_url未登録校はスキップ）'}`);
  console.log(`Dry run: ${args.dryRun} | Sleep: ${args.sleepMs}ms`);
  console.log(`Base URL: ${args.baseUrl}`);
  console.log('※ 結果はすべて draft 保存です。公開は管理画面から人間が行ってください。');

  if (!args.schoolId && !args.prefecture) {
    console.error('\nERROR: --school-id=xxx または --prefecture=xxx を指定してください');
    process.exit(1);
  }
  if (args.tuitionUrl && !args.schoolId) {
    console.error('\nERROR: --tuition-url は --school-id と併用してください');
    process.exit(1);
  }

  const startTime = Date.now();
  let targets: TargetSchool[];

  if (args.schoolId) {
    targets = [{ id: args.schoolId, name: args.schoolId, official_url: null, review_count: 0 }];
  } else {
    targets = await fetchTargetSchools(args);
    console.log(`\n対象: ${targets.length}校`);
    const missingUrl = targets.filter((t) => !t.official_url);
    if (missingUrl.length > 0 && !args.usePerplexity) {
      console.log(`うち official_url 未登録（スキップ予定）: ${missingUrl.length}校`);
      for (const t of missingUrl) {
        console.log(`  - ${t.name}`);
      }
    }
  }

  const results: ExtractResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const school = targets[i];
    try {
      const result = await callExtractApi(args, apiKey, school);
      results.push(result);
      const mark = result.status === 'ok' ? 'OK  ' : result.status === 'skipped' ? 'SKIP' : 'ERR ';
      console.log(`\n[${i + 1}/${targets.length}] ${mark} ${result.school_name}`);
      console.log(`  ${result.detail}`);
      for (const warning of result.warnings) {
        console.log(`  警告: ${warning}`);
      }
      if (result.tokens > 0) {
        console.log(`  → OpenAI ${result.tokens.toLocaleString()} tokens`);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      results.push({
        school_id: school.id,
        school_name: school.name,
        status: 'error',
        detail,
        warnings: [],
        tokens: 0,
      });
      console.log(`\n[${i + 1}/${targets.length}] ERR  ${school.name}`);
      console.log(`  ${detail}`);
    }
    if (args.sleepMs > 0 && i < targets.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  // サマリー
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

  console.log('\n' + '='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Total: ${results.length} schools (${elapsed}s)`);
  console.log(`  OK: ${ok} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`Tokens: OpenAI ${totalTokens.toLocaleString()} (~$${((totalTokens / 1_000_000) * 2.5).toFixed(3)})`);
  if (ok > 0 && !args.dryRun) {
    console.log('\n次のステップ: 管理画面の「学費目安」タブで各校の draft を確認し、出典と照合してから公開してください。');
  }

  const logPath = saveLog(results, args);
  console.log(`\nDetails: ${logPath}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
