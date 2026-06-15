/**
 * AI エージェント: 学費目安・コース一覧の一括抽出 CLI
 *
 * 1校ずつGoogleで調べてURLを入力する手間をなくすための一括処理。
 * 各学校について次を順に実行する:
 *   1. 公式URL（schools.official_url）が未登録なら Perplexity で特定して schools に保存
 *      （official_url_verified=false の「未確認」状態。あとで管理画面の人間が確認・確定する）
 *   2. 学費目安をAI抽出 → draft 保存
 *   3. コース一覧をAI抽出 → draft 保存
 *
 * 公開は一切自動で行わない。すべて draft 保存で、最後に管理画面で人間が確認して公開する。
 *
 * 使い方:
 *   npx tsx scripts/agent-school-info.ts --school-id=xxx
 *   npx tsx scripts/agent-school-info.ts --prefecture=東京都 --limit=20
 *   npx tsx scripts/agent-school-info.ts --prefecture=東京都 --limit=20 --resolve-url
 *   npx tsx scripts/agent-school-info.ts --prefecture=東京都 --only=tuition
 *   npx tsx scripts/agent-school-info.ts --prefecture=東京都 --only=courses
 *   npx tsx scripts/agent-school-info.ts --prefecture=東京都 --dry-run
 *
 * 主なオプション:
 *   --resolve-url   公式URL未登録校について Perplexity でURLを特定し schools に保存する（未指定だとURL未登録校はスキップ）
 *   --only=tuition  学費のみ / --only=courses コースのみ（既定は両方）
 *   --force-url     既に登録済みの公式URLも上書きして特定し直す（--resolve-url と併用）
 *   --order=reviews 口コミ件数の多い順（既定）/ --order=name 名前順
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// --- 引数パース ---

type ExtractTarget = 'both' | 'tuition' | 'courses';

interface CliArgs {
  schoolId: string | null;
  prefecture: string | null;
  limit: number;
  order: 'reviews' | 'name';
  only: ExtractTarget;
  resolveUrl: boolean;
  forceUrl: boolean;
  dryRun: boolean;
  sleepMs: number;
  baseUrl: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    schoolId: null,
    prefecture: null,
    limit: 20,
    order: 'reviews',
    only: 'both',
    resolveUrl: false,
    forceUrl: false,
    dryRun: false,
    sleepMs: 1000,
    baseUrl: process.env.AGENT_BASE_URL || 'http://localhost:3000/tsushin-kuchikomi',
  };

  for (const arg of args) {
    if (arg.startsWith('--school-id=')) {
      parsed.schoolId = arg.split('=')[1];
    } else if (arg.startsWith('--prefecture=')) {
      parsed.prefecture = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      parsed.limit = parseInt(arg.split('=')[1], 10) || 20;
    } else if (arg.startsWith('--order=')) {
      parsed.order = arg.split('=')[1] === 'name' ? 'name' : 'reviews';
    } else if (arg.startsWith('--only=')) {
      const value = arg.split('=')[1];
      parsed.only = value === 'tuition' || value === 'courses' ? value : 'both';
    } else if (arg === '--resolve-url') {
      parsed.resolveUrl = true;
    } else if (arg === '--force-url') {
      parsed.forceUrl = true;
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
    official_url: typeof s.official_url === 'string' && s.official_url.trim() ? s.official_url.trim() : null,
    review_count: counts.get(s.id) || 0,
  }));

  if (args.order === 'reviews') {
    targets.sort((a, b) => b.review_count - a.review_count);
  } else {
    targets.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  return targets.slice(0, args.limit);
}

// --- API 呼び出し ---

type StepStatus = 'ok' | 'skipped' | 'error' | 'not_run';

interface StepResult {
  status: StepStatus;
  detail: string;
  warnings: string[];
  tokens: number;
}

interface SchoolResult {
  school_id: string;
  school_name: string;
  url: StepResult;
  tuition: StepResult;
  courses: StepResult;
}

const NOT_RUN: StepResult = { status: 'not_run', detail: '実行せず', warnings: [], tokens: 0 };

async function postJson(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: any }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body: json };
}

async function resolveOfficialUrl(
  args: CliArgs,
  apiKey: string,
  school: TargetSchool
): Promise<StepResult> {
  const url = `${args.baseUrl}/api/admin/schools/${school.id}/official-url/resolve`;
  const { ok, status, body } = await postJson(url, apiKey, {
    force: args.forceUrl,
    dryRun: args.dryRun,
  });

  if (!ok) {
    return { status: 'error', detail: body.message || body.error || `HTTP ${status}`, warnings: [], tokens: 0 };
  }
  if (body.skipped) {
    return { status: 'skipped', detail: body.reason || 'skipped', warnings: [], tokens: 0 };
  }
  const tokens = body.tokens_used?.total ?? 0;
  return {
    status: 'ok',
    detail: args.dryRun
      ? `dry-run（特定: ${body.official_url} / confidence=${body.confidence}）`
      : `公式URLを保存（未確認）: ${body.official_url}（confidence=${body.confidence}）`,
    warnings: [],
    tokens,
  };
}

async function extractTuition(
  args: CliArgs,
  apiKey: string,
  school: TargetSchool
): Promise<StepResult> {
  const url = `${args.baseUrl}/api/admin/schools/${school.id}/tuition/extract`;
  const { ok, status, body } = await postJson(url, apiKey, { dryRun: args.dryRun });

  if (!ok) {
    return { status: 'error', detail: body.message || body.error || `HTTP ${status}`, warnings: [], tokens: 0 };
  }
  if (body.skipped) {
    return { status: 'skipped', detail: body.reason || 'skipped', warnings: [], tokens: 0 };
  }
  const found = body.found_tuition_info ?? body.extraction?.foundTuitionInfo;
  const warnings: string[] = body.warnings || body.extraction?.warnings || [];
  const tokens = body.tokens_used?.total ?? body.extraction?.tokensUsed?.total ?? 0;
  return {
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

async function extractCourses(
  args: CliArgs,
  apiKey: string,
  school: TargetSchool
): Promise<StepResult> {
  const url = `${args.baseUrl}/api/admin/schools/${school.id}/courses/extract`;
  const { ok, status, body } = await postJson(url, apiKey, { dryRun: args.dryRun });

  if (!ok) {
    return { status: 'error', detail: body.message || body.error || `HTTP ${status}`, warnings: [], tokens: 0 };
  }
  if (body.skipped) {
    return { status: 'skipped', detail: body.reason || 'skipped', warnings: [], tokens: 0 };
  }
  const found = body.found_courses ?? body.extraction?.foundCourses;
  const warnings: string[] = body.warnings || body.extraction?.warnings || [];
  const tokens = body.tokens_used?.total ?? body.extraction?.tokensUsed?.total ?? 0;
  return {
    status: 'ok',
    detail: args.dryRun
      ? `dry-run（コース${found ? 'あり' : 'なし'}）`
      : found
        ? 'コース名を抽出して draft 保存（要確認）'
        : 'コース名は検出できず（draft保存）',
    warnings,
    tokens,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveLog(results: SchoolResult[], args: CliArgs): string {
  const date = new Date().toISOString().slice(0, 10);
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `agent-school-info-${date}.json`);
  fs.writeFileSync(
    logPath,
    JSON.stringify({ timestamp: new Date().toISOString(), args, results }, null, 2),
    'utf-8'
  );
  return logPath;
}

function mark(status: StepStatus): string {
  return status === 'ok' ? 'OK  ' : status === 'skipped' ? 'SKIP' : status === 'error' ? 'ERR ' : '--  ';
}

// --- メイン ---

async function main() {
  const args = parseArgs();
  const apiKey = getApiKey();

  console.log('='.repeat(60));
  console.log('AI Agent: 学費・コース 一括抽出');
  console.log('='.repeat(60));
  console.log(`Mode: ${args.schoolId ? `school ${args.schoolId}` : `prefecture=${args.prefecture || '(全国)'} limit=${args.limit} order=${args.order}`}`);
  console.log(`抽出対象: ${args.only === 'both' ? '学費＋コース' : args.only === 'tuition' ? '学費のみ' : 'コースのみ'}`);
  console.log(`公式URL自動特定: ${args.resolveUrl ? `有効${args.forceUrl ? '（既存も上書き）' : '（未登録校のみ）'}` : '無効（URL未登録校はスキップ）'}`);
  console.log(`Dry run: ${args.dryRun} | Sleep: ${args.sleepMs}ms`);
  console.log(`Base URL: ${args.baseUrl}`);
  console.log('※ 結果はすべて draft 保存です。公開は管理画面から人間が行ってください。');

  if (!args.schoolId && !args.prefecture) {
    console.error('\nERROR: --school-id=xxx または --prefecture=xxx を指定してください');
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
    if (missingUrl.length > 0) {
      console.log(`うち official_url 未登録: ${missingUrl.length}校${args.resolveUrl ? '（Perplexityで特定を試みます）' : '（--resolve-url 未指定のためスキップ予定）'}`);
    }
  }

  const doTuition = args.only === 'both' || args.only === 'tuition';
  const doCourses = args.only === 'both' || args.only === 'courses';

  const results: SchoolResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const school = targets[i];
    const result: SchoolResult = {
      school_id: school.id,
      school_name: school.name,
      url: { ...NOT_RUN },
      tuition: { ...NOT_RUN },
      courses: { ...NOT_RUN },
    };

    // 1. 公式URLの自動特定（未登録校 or --force-url のとき）
    if (args.resolveUrl && (!school.official_url || args.forceUrl)) {
      try {
        result.url = await resolveOfficialUrl(args, apiKey, school);
      } catch (e) {
        result.url = { status: 'error', detail: e instanceof Error ? e.message : String(e), warnings: [], tokens: 0 };
      }
    }

    // 2. 学費抽出
    if (doTuition) {
      try {
        result.tuition = await extractTuition(args, apiKey, school);
      } catch (e) {
        result.tuition = { status: 'error', detail: e instanceof Error ? e.message : String(e), warnings: [], tokens: 0 };
      }
    }

    // 3. コース抽出
    if (doCourses) {
      try {
        result.courses = await extractCourses(args, apiKey, school);
      } catch (e) {
        result.courses = { status: 'error', detail: e instanceof Error ? e.message : String(e), warnings: [], tokens: 0 };
      }
    }

    results.push(result);

    console.log(`\n[${i + 1}/${targets.length}] ${school.name}`);
    if (result.url.status !== 'not_run') {
      console.log(`  URL    ${mark(result.url.status)} ${result.url.detail}`);
    }
    if (doTuition) {
      console.log(`  学費   ${mark(result.tuition.status)} ${result.tuition.detail}`);
      for (const w of result.tuition.warnings) console.log(`         警告: ${w}`);
    }
    if (doCourses) {
      console.log(`  コース ${mark(result.courses.status)} ${result.courses.detail}`);
      for (const w of result.courses.warnings) console.log(`         警告: ${w}`);
    }

    if (args.sleepMs > 0 && i < targets.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  // サマリー
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const count = (pick: (r: SchoolResult) => StepResult, status: StepStatus) =>
    results.filter((r) => pick(r).status === status).length;
  const totalTokens = results.reduce(
    (sum, r) => sum + r.url.tokens + r.tuition.tokens + r.courses.tokens,
    0
  );

  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${results.length} schools (${elapsed}s)`);
  if (args.resolveUrl) {
    console.log(`  URL特定:  OK ${count((r) => r.url, 'ok')} | Skip ${count((r) => r.url, 'skipped')} | Err ${count((r) => r.url, 'error')}`);
  }
  if (doTuition) {
    console.log(`  学費:     OK ${count((r) => r.tuition, 'ok')} | Skip ${count((r) => r.tuition, 'skipped')} | Err ${count((r) => r.tuition, 'error')}`);
  }
  if (doCourses) {
    console.log(`  コース:   OK ${count((r) => r.courses, 'ok')} | Skip ${count((r) => r.courses, 'skipped')} | Err ${count((r) => r.courses, 'error')}`);
  }
  console.log(`Tokens（OpenAI+Perplexity 合算）: ${totalTokens.toLocaleString()}`);

  if (!args.dryRun) {
    console.log('\n次のステップ:');
    if (args.resolveUrl) {
      console.log('  1. 管理画面の各校「基本情報」タブで、AI推定の公式URL（未確認）を確認して保存（確定）してください。');
    }
    console.log(`  ${args.resolveUrl ? '2' : '1'}. 管理画面の「学費目安」「コース」タブで draft を出典と照合し、公開してください。`);
  }

  const logPath = saveLog(results, args);
  console.log(`\nDetails: ${logPath}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
