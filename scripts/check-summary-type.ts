import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: allOverall } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, summary_text, status, meta_title, generated_at')
    .eq('kind', 'overall')
    .is('topic', null)
    .not('summary_text', 'is', null)
    .neq('summary_text', '')
    .order('generated_at', { ascending: false });

  if (!allOverall) { console.log('No data'); return; }

  let kuchikomiBase = 0;
  let perplexityBase = 0;
  let other = 0;

  const kuchikomiSamples: string[] = [];
  const perplexitySamples: string[] = [];

  for (const d of allOverall) {
    const t = d.summary_text || '';
    const isKuchikomi = t.includes('\u3053\u306E\u5B66\u6821\u304C\u5408\u3046\u4EBA') ||
                        t.includes('\u53E3\u30B3\u30DF\u30FB\u8A55\u5224\u3092\u3082\u3068\u306B') ||
                        t.includes('\u203B\u672C\u30DA\u30FC\u30B8\u306E\u53E3\u30B3\u30DF');

    if (isKuchikomi) {
      kuchikomiBase++;
      if (kuchikomiSamples.length < 2) {
        kuchikomiSamples.push(`[${d.status}] ${t.replace(/[\r\n]+/g, ' ').slice(0, 120)}`);
      }
    } else if (t.length > 50) {
      perplexityBase++;
      if (perplexitySamples.length < 2) {
        perplexitySamples.push(`[${d.status}] ${t.replace(/[\r\n]+/g, ' ').slice(0, 120)}`);
      }
    } else {
      other++;
    }
  }

  console.log(`=== summary_text \u7A2E\u5225\u96C6\u8A08 (total: ${allOverall.length}) ===`);
  console.log(`\u53E3\u30B3\u30DF\u30D9\u30FC\u30B9: ${kuchikomiBase}\u4EF6`);
  kuchikomiSamples.forEach(s => console.log(`  ${s}`));
  console.log(`Perplexity\u30D9\u30FC\u30B9: ${perplexityBase}\u4EF6`);
  perplexitySamples.forEach(s => console.log(`  ${s}`));
  console.log(`\u305D\u306E\u4ED6/\u77ED\u3044: ${other}\u4EF6`);

  // published vs draft
  const pubCount = allOverall.filter(d => d.status === 'published').length;
  const draftCount = allOverall.filter(d => d.status === 'draft').length;
  console.log(`\npublished: ${pubCount}, draft: ${draftCount}`);

  // summary_text\u304C\u7A7A\u306E\u30EC\u30B3\u30FC\u30C9
  const { data: emptySummary } = await supabase
    .from('school_ai_summaries')
    .select('id, school_id, summary_text, meta_title, status')
    .eq('kind', 'overall')
    .is('topic', null)
    .or('summary_text.is.null,summary_text.eq.');

  console.log(`\nsummary_text\u304C\u7A7A\u306E\u30EC\u30B3\u30FC\u30C9: ${emptySummary?.length || 0}\u4EF6`);
  emptySummary?.slice(0, 5).forEach(d => {
    console.log(`  title=${(d.meta_title || '').slice(0, 30)} status=${d.status}`);
  });
}

main().catch(console.error);
