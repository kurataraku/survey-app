import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, slug, status')
    .eq('status', 'active')
    .eq('is_public', true);

  const { data: reviewCounts } = await supabase
    .from('survey_responses')
    .select('school_id')
    .eq('is_public', true);

  const countMap = new Map<string, number>();
  (reviewCounts || []).forEach((r: any) => {
    countMap.set(r.school_id, (countMap.get(r.school_id) || 0) + 1);
  });

  const schoolsWithReviews = (schools || []).filter((s) => (countMap.get(s.id) || 0) >= 1);

  const { data: allSummaries } = await supabase
    .from('school_ai_summaries')
    .select('school_id, kind, topic, status, meta_title, meta_description')
    .eq('kind', 'overall')
    .is('topic', null);

  const summaryMap = new Map<string, any>();
  (allSummaries || []).forEach((s: any) => {
    const existing = summaryMap.get(s.school_id);
    if (!existing || s.status === 'published') {
      summaryMap.set(s.school_id, s);
    }
  });

  const rows: string[] = [];
  rows.push([
    '学校名',
    '学校ID',
    'スラグ',
    '口コミ数',
    'Meta Title',
    'Meta Title文字数',
    'Meta Title問題',
    'Meta Description',
    'Meta Description文字数',
    'Meta Description問題',
    '管理画面URL',
  ].join(','));

  for (const school of schoolsWithReviews) {
    const summary = summaryMap.get(school.id);
    const title = summary?.meta_title || '';
    const desc = summary?.meta_description || '';
    const titleLen = title.length;
    const descLen = desc.length;
    const titleShort = titleLen > 0 && titleLen < 28;
    const descShort = descLen > 0 && descLen < 100;

    if (!titleShort && !descShort) continue;

    const reviews = countMap.get(school.id) || 0;
    const adminUrl = `https://careeressence.jp/tsushin-kuchikomi/admin/schools/${school.id}/edit`;

    const issues: string[] = [];
    if (titleShort) issues.push(`Title短い(${titleLen}字)`);
    if (descShort) issues.push(`Desc短い(${descLen}字)`);

    rows.push([
      csvEscape(school.name),
      school.id,
      csvEscape(school.slug || ''),
      String(reviews),
      csvEscape(title),
      String(titleLen),
      titleShort ? `短い(${titleLen}字<28字)` : 'OK',
      csvEscape(desc),
      String(descLen),
      descShort ? `短い(${descLen}字<100字)` : 'OK',
      adminUrl,
    ].join(','));
  }

  const outputPath = path.join(process.cwd(), 'meta-issues.csv');
  const bom = '\uFEFF';
  fs.writeFileSync(outputPath, bom + rows.join('\n'), 'utf-8');
  console.log(`CSV出力完了: ${outputPath}`);
  console.log(`対象校数: ${rows.length - 1}校`);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

main().catch(console.error);
