/**
 * 愛知説明会スケジュール記事を articles に公開挿入するワンショット。
 *   npx tsx scripts/publish-aichi-setsumeikai-article.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  publicFeatureArticleUrl,
  submitIndexNowUrls,
} from '../lib/indexnow/submitIndexNow';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SLUG = 'aichi-tsushin-setsumeikai-2026-schedule';
const SCHOOL_SLUGS = [
  'oozora-kuchikomi',
  'asukamirai-kuchikomi',
  'try-gakuin-kuchikomi',
  'clark-kuchikomi',
  'daiichi-gakuin-kuchikomi',
  'renaissance-toyota-koukou-kuchikomi',
];

function parseDraft(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^<!--\n([\s\S]*?)\n-->\n([\s\S]*)$/);
  if (!match) {
    throw new Error('フロントマター（HTMLコメント）が見つかりません');
  }
  const metaBlock = match[1];
  const content = match[2].trim();

  const get = (key: string) => {
    const line = metaBlock.split('\n').find((l) => l.startsWith(`${key}:`));
    if (!line) return '';
    return line.slice(key.length + 1).trim();
  };

  return {
    title: get('title'),
    slug: get('slug'),
    category: get('category'),
    excerpt: get('excerpt'),
    meta_title: get('meta_title'),
    meta_description: get('meta_description'),
    content,
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  }

  const draftPath = path.join(
    process.cwd(),
    '記事下書き',
    'aichi-tsushin-setsumeikai-2026-schedule.md'
  );
  const draft = parseDraft(draftPath);
  if (draft.slug !== SLUG) {
    throw new Error(`slug不一致: ${draft.slug}`);
  }
  if (draft.category !== 'useful_info') {
    throw new Error(`category不正: ${draft.category}`);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: existing } = await supabase
    .from('articles')
    .select('id, is_public')
    .eq('slug', SLUG)
    .maybeSingle();

  const payload = {
    title: draft.title,
    slug: draft.slug,
    category: draft.category,
    content: draft.content,
    excerpt: draft.excerpt,
    meta_title: draft.meta_title,
    meta_description: draft.meta_description,
    is_public: true,
    published_at: new Date().toISOString(),
  };

  let articleId: string;
  if (existing?.id) {
    const updatePayload = existing.is_public
      ? {
          title: payload.title,
          slug: payload.slug,
          category: payload.category,
          content: payload.content,
          excerpt: payload.excerpt,
          meta_title: payload.meta_title,
          meta_description: payload.meta_description,
          is_public: true,
        }
      : payload;
    const { data, error } = await supabase
      .from('articles')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(`記事更新失敗: ${error?.message}`);
    }
    articleId = data.id;
    console.log('updated article', articleId);
  } else {
    const { data, error } = await supabase
      .from('articles')
      .insert(payload)
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(`記事作成失敗: ${error?.message}`);
    }
    articleId = data.id;
    console.log('created article', articleId);
  }

  const { data: schools, error: schoolError } = await supabase
    .from('schools')
    .select('id, slug, name')
    .in('slug', SCHOOL_SLUGS);

  if (schoolError) {
    throw new Error(`学校取得失敗: ${schoolError.message}`);
  }

  const bySlug = new Map((schools || []).map((s) => [s.slug as string, s]));
  for (const slug of SCHOOL_SLUGS) {
    if (!bySlug.has(slug)) {
      console.warn('school slug not found:', slug);
    }
  }

  await supabase.from('article_schools').delete().eq('article_id', articleId);

  const rows = SCHOOL_SLUGS.map((slug, index) => {
    const school = bySlug.get(slug);
    if (!school) return null;
    return {
      article_id: articleId,
      school_id: school.id,
      display_order: index,
    };
  }).filter(Boolean);

  if (rows.length > 0) {
    const { error: linkError } = await supabase.from('article_schools').insert(rows);
    if (linkError) {
      throw new Error(`関連学校紐付け失敗: ${linkError.message}`);
    }
  }

  console.log(
    'linked schools:',
    rows.length,
    SCHOOL_SLUGS.filter((s) => bySlug.has(s)).join(', ')
  );

  const publicUrl = publicFeatureArticleUrl(SLUG);
  await submitIndexNowUrls([publicUrl]);
  console.log('public url:', publicUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
