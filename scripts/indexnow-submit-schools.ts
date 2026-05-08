/**
 * 公開中かつ slug ありの学校ページを IndexNow に一括通知する。
 * INDEXNOW_KEY / INDEXNOW_HOST が無い場合は no-op（API と submitIndexNow と同じ）。
 *
 *   npm run indexnow:schools -- --dry-run
 *   npm run indexnow:schools
 *   npm run indexnow:schools -- --prefecture-pages   # 47都道府県LPも同梱
 *   npm run indexnow:schools -- --ranking-pages      # 6種ランキングLPも同梱
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { prefectures } from '@/lib/prefectures';
import {
  publicPrefectureSchoolsUrl,
  publicRankingUrl,
  publicSchoolUrl,
  submitIndexNowUrls,
} from '@/lib/indexnow/submitIndexNow';

/** app/(survey)/rankings/[type]/page.tsx の generateStaticParams と一致 */
const RANKING_TYPES = ['overall', 'review-count', 'staff', 'atmosphere', 'credit', 'tuition'] as const;

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const CHUNK = 10000;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const withPrefecturePages = process.argv.includes('--prefecture-pages');
  const withRankingPages = process.argv.includes('--ranking-pages');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const indexKey = process.env.INDEXNOW_KEY;
  const indexHost = process.env.INDEXNOW_HOST;
  if (!dryRun && (!indexKey || !indexHost)) {
    console.warn(
      'INDEXNOW_KEY または INDEXNOW_HOST が未設定のため送信しません（no-op）。.env.local を確認してください。'
    );
    process.exit(0);
  }

  const supabase = createClient(url, key);

  const { data: rows, error } = await supabase
    .from('schools')
    .select('slug')
    .eq('status', 'active')
    .eq('is_public', true)
    .not('slug', 'is', null);

  if (error) {
    console.error('学校取得エラー:', error.message);
    process.exit(1);
  }

  const schoolUrls: string[] = [];
  for (const row of rows ?? []) {
    const s = typeof row.slug === 'string' ? row.slug.trim() : '';
    if (!s) continue;
    schoolUrls.push(publicSchoolUrl(s));
  }

  const urls = [...schoolUrls];
  if (withPrefecturePages) {
    for (const p of prefectures) {
      urls.push(publicPrefectureSchoolsUrl(p));
    }
  }
  if (withRankingPages) {
    for (const t of RANKING_TYPES) {
      urls.push(publicRankingUrl(t));
    }
  }

  console.log(`=== IndexNow 学校URL送信 ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`学校URL: ${schoolUrls.length} 件`);
  if (withPrefecturePages) {
    console.log(`都道府県LP: ${prefectures.length} 件`);
  }
  if (withRankingPages) {
    console.log(`ランキングLP: ${RANKING_TYPES.length} 件`);
  }
  console.log(`合計: ${urls.length} 件\n`);

  if (dryRun) {
    const preview = urls.slice(0, 15);
    for (const u of preview) console.log(`  [DRY] ${u}`);
    if (urls.length > preview.length) console.log(`  ... 他 ${urls.length - preview.length} 件`);
    console.log('\n※ DRY RUN のため IndexNow には送っていません。');
    return;
  }

  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    await submitIndexNowUrls(slice);
    console.log(`送信: ${i + 1}〜${i + slice.length} / ${urls.length}`);
  }
  console.log('\n完了（IndexNow が 202 を返す場合もあります）');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
