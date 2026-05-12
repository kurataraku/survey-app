/**
 * SEO カバレッジ集計（公開校数・学校紹介 intro の有無・AI要約 published 件数・公開記事数）
 * 使い方: npx tsx scripts/seo-coverage.ts
 */import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { count: activeSchools } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('is_public', true);

  const { count: publishedOverall } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'published');

  const { count: publishedSeo } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'seo')
    .eq('status', 'published');

  const { count: publishedTendency } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'review_tendency')
    .is('topic', null)
    .eq('status', 'published');

  const { count: draftOverall } = await supabase
    .from('school_ai_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'draft');

  const { count: publicArticles } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true);

  const { count: unknownPref } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('prefecture', '不明');

  /** 学校紹介（intro）が1文字以上ある公開校（口コミなし校の掲載情報の目安） */
  const { count: introNonEmpty } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('is_public', true)
    .not('intro', 'is', null)
    .neq('intro', '');

  console.log(JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      schools_active_public: activeSchools ?? 0,
      schools_intro_nonempty: introNonEmpty ?? 0,
      ai_summaries_overall_published: publishedOverall ?? 0,
      ai_summaries_overall_draft: draftOverall ?? 0,
      ai_summaries_seo_rows_published: publishedSeo ?? 0,
      ai_summaries_review_tendency_published: publishedTendency ?? 0,
      articles_public: publicArticles ?? 0,
      schools_prefecture_unknown: unknownPref ?? 0,
    },
    null,
    2
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
