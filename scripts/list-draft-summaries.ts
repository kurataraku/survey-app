/**
 * AI要約の下書き一覧を学校名付きで表示
 *   npx tsx scripts/list-draft-summaries.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // kind=overall, topic=null の全件（draft + published）を学校名付きで取得
  const { data: rows, error } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, kind, topic, status, generated_at')
    .eq('kind', 'overall')
    .is('topic', null)
    .order('school_id');

  if (error) {
    console.error(error);
    return;
  }

  const schoolIds = [...new Set((rows || []).map((r) => r.school_id))];
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .in('id', schoolIds);
  const nameMap = new Map((schools || []).map((s) => [s.id, s.name]));

  const draft = (rows || []).filter((r) => r.status === 'draft');
  const published = (rows || []).filter((r) => r.status === 'published');

  console.log('=== AI要約（口コミ要約）overall の状態 ===\n');
  console.log(`下書き: ${draft.length}件`);
  console.log(`公開済み: ${published.length}件`);
  console.log(`合計: ${rows?.length || 0}件\n`);

  if (draft.length > 0) {
    console.log('--- 下書きの該当学校 ---');
    draft.forEach((r, i) => {
      const name = nameMap.get(r.school_id) || r.school_id;
      console.log(`${i + 1}. ${name} (school_id=${r.school_id}, summary_id=${r.id})`);
    });
  }

  console.log('\n--- 公開済みの学校（先頭10件）---');
  published.slice(0, 10).forEach((r, i) => {
    const name = nameMap.get(r.school_id) || r.school_id;
    console.log(`${i + 1}. ${name}`);
  });
  if (published.length > 10) {
    console.log(`... 他 ${published.length - 10}件`);
  }
}

main().catch(console.error);
