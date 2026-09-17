/**
 * 公開中の学校紹介文・AI要約から、生成失敗文や引用番号などの生成用記号を検出するCLI。
 *
 * 使い方:
 *   npx tsx scripts/audit-ai-text-artifacts.ts
 *   npx tsx scripts/audit-ai-text-artifacts.ts --json > artifacts.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  hasCitationMarkers,
  hasGenerationArtifacts,
  hasGenerationFailureText,
} from '@/lib/content/aiTextGuard';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type Finding = {
  schoolId: string;
  schoolName: string;
  prefecture: string | null;
  field: string;
  issue: 'failure_text' | 'artifact';
  excerpt: string;
};

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

/**
 * @param mode plain=プレーンテキスト欄（Markdown記号も不正） / markdown=Markdown描画する本文（引用番号のみ不正）
 */
function inspect(
  text: string | null | undefined,
  base: Omit<Finding, 'issue' | 'excerpt'>,
  mode: 'plain' | 'markdown'
): Finding[] {
  if (!text) return [];
  const findings: Finding[] = [];
  if (hasGenerationFailureText(text)) {
    findings.push({ ...base, issue: 'failure_text', excerpt: excerpt(text) });
  }
  const hasArtifact =
    mode === 'plain' ? hasGenerationArtifacts(text) : hasCitationMarkers(text);
  if (hasArtifact) {
    findings.push({ ...base, issue: 'artifact', excerpt: excerpt(text) });
  }
  return findings;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: schools, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name, prefecture, intro, highlights')
    .eq('status', 'active')
    .eq('is_public', true);
  if (schoolsError) throw schoolsError;

  const schoolById = new Map(
    (schools ?? []).map((school) => [school.id, school] as const)
  );

  const { data: summaries, error: summariesError } = await supabase
    .from('school_ai_summaries')
    .select('school_id, kind, topic, summary_text')
    .eq('status', 'published');
  if (summariesError) throw summariesError;

  const findings: Finding[] = [];

  for (const school of schools ?? []) {
    const base = {
      schoolId: school.id,
      schoolName: school.name,
      prefecture: school.prefecture ?? null,
    };
    findings.push(...inspect(school.intro, { ...base, field: 'schools.intro' }, 'plain'));
    for (const [index, highlight] of (school.highlights ?? []).entries()) {
      findings.push(
        ...inspect(highlight, { ...base, field: `schools.highlights[${index}]` }, 'plain')
      );
    }
  }

  for (const summary of summaries ?? []) {
    const school = schoolById.get(summary.school_id);
    if (!school) continue;
    findings.push(
      ...inspect(
        summary.summary_text,
        {
          schoolId: summary.school_id,
          schoolName: school.name,
          prefecture: school.prefecture ?? null,
          field: `school_ai_summaries.${summary.kind}${summary.topic ? `:${summary.topic}` : ''}`,
        },
        'markdown'
      )
    );
  }

  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  if (asJson || outArg) {
    const json = JSON.stringify({ total: findings.length, findings }, null, 2);
    // Windows のコンソール文字化けを避けるため、ファイル出力は Node から直接 UTF-8 で書く
    const outPath = outArg?.slice('--out='.length) ?? 'ai-text-artifacts.json';
    fs.writeFileSync(path.resolve(process.cwd(), outPath), json, 'utf8');
    console.log(`wrote ${findings.length} findings to ${outPath}`);
    return;
  }

  const failures = findings.filter((f) => f.issue === 'failure_text');
  const artifacts = findings.filter((f) => f.issue === 'artifact');

  console.log(`対象学校: ${schools?.length ?? 0}校 / 公開AI要約: ${summaries?.length ?? 0}件`);
  console.log(`生成失敗文: ${failures.length}件 / 生成用記号: ${artifacts.length}件`);

  const byField = new Map<string, number>();
  for (const finding of findings) {
    const key = finding.field.split(/[[:]/)[0];
    byField.set(key, (byField.get(key) ?? 0) + 1);
  }
  console.log('\n--- 対象フィールド別件数 ---');
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${field}: ${count}`);
  }

  const byPrefecture = new Map<string, number>();
  for (const finding of findings) {
    const key = finding.prefecture ?? '不明';
    byPrefecture.set(key, (byPrefecture.get(key) ?? 0) + 1);
  }
  console.log('\n--- 都道府県別件数 ---');
  for (const [prefecture, count] of [...byPrefecture.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${prefecture}: ${count}`);
  }

  console.log('\n--- 生成失敗文 ---');
  for (const finding of failures) {
    console.log(`[${finding.prefecture ?? '不明'}] ${finding.schoolName} / ${finding.field}`);
    console.log(`  ${finding.excerpt}`);
  }

  console.log('\n--- 生成用記号（先頭30件） ---');
  for (const finding of artifacts.slice(0, 30)) {
    console.log(`[${finding.prefecture ?? '不明'}] ${finding.schoolName} / ${finding.field}`);
    console.log(`  ${finding.excerpt}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
