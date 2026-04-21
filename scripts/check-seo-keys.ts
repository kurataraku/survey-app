import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('school_ai_summaries')
    .select('kind, topic, status')
    .eq('kind', 'seo');

  const topicCounts = new Map<string, { published: number; draft: number }>();
  (data || []).forEach((row: any) => {
    const key = row.topic || '(null)';
    const entry = topicCounts.get(key) || { published: 0, draft: 0 };
    if (row.status === 'published') entry.published++;
    else entry.draft++;
    topicCounts.set(key, entry);
  });

  console.log('SEO kind のレコード数:', data?.length || 0);
  console.log('\ntopic別の内訳:');
  [...topicCounts.entries()].sort().forEach(([topic, counts]) => {
    console.log(`  ${topic}: published=${counts.published}, draft=${counts.draft}`);
  });

  // review_tendency の件数
  const { data: tendencies, count } = await supabase
    .from('review_tendency')
    .select('status', { count: 'exact' });

  const tendCounts = new Map<string, number>();
  (tendencies || []).forEach((t: any) => {
    tendCounts.set(t.status, (tendCounts.get(t.status) || 0) + 1);
  });

  console.log(`\nreview_tendency: ${count}件`);
  [...tendCounts.entries()].forEach(([status, c]) => {
    console.log(`  ${status}: ${c}`);
  });

  // overall kind の件数
  const { data: overalls } = await supabase
    .from('school_ai_summaries')
    .select('status')
    .eq('kind', 'overall');

  const overallCounts = new Map<string, number>();
  (overalls || []).forEach((o: any) => {
    overallCounts.set(o.status, (overallCounts.get(o.status) || 0) + 1);
  });

  console.log(`\noverall kind: ${overalls?.length || 0}件`);
  [...overallCounts.entries()].forEach(([status, c]) => {
    console.log(`  ${status}: ${c}`);
  });
}

main().catch(console.error);
