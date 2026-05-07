import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { hasJapaneseSlug } from '@/lib/utils';
import { callOpenAIForPrefecture, callOpenAIForMeta, callOpenAIForSummary, callOpenAIForSlug } from '@/lib/openai/client';
import { callOpenAIForSeoSection } from '@/lib/openai/client';
import { callOpenAIForFaq } from '@/lib/openai/client';
import { callOpenAIForReviewTendency } from '@/lib/openai/client';
import { callPerplexityForSummary } from '@/lib/perplexity/client';
import { prefectures as VALID_PREFECTURES } from '@/lib/prefectures';
import { SEO_SECTION_KEYS } from '@/lib/seo-sections';
import { createHash } from 'crypto';

function sourceSignature(count: number, maxCreatedAt: string | null): string {
  const data = `${count}|${maxCreatedAt || ''}`;
  return createHash('sha256').update(data).digest('hex');
}

interface Alert {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface StepResult {
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  value?: string;
  [key: string]: unknown;
}

type StepName = 'prefecture' | 'slug' | 'intro' | 'summary' | 'meta' | 'seo_sections' | 'faq' | 'review_tendency';

const ALL_STEPS: StepName[] = ['prefecture', 'slug', 'intro', 'summary', 'meta', 'seo_sections', 'faq', 'review_tendency'];

async function getPublicReviewCount(supabase: ReturnType<typeof createAdminSupabaseClient>, schoolId: string): Promise<number> {
  const { count } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('is_public', true);
  return count || 0;
}

async function getPublicReviews(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  schoolId: string,
  limit = 100
) {
  const { data } = await supabase
    .from('survey_responses')
    .select('id, good_comment, bad_comment, overall_satisfaction, created_at, answers')
    .eq('school_id', schoolId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function getExistingPublishedSummary(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  schoolId: string,
  kind: string,
  topic: string | null = null
) {
  let query = supabase
    .from('school_ai_summaries')
    .select('id, summary_text, meta_title, meta_description, reviews_count_used, status')
    .eq('school_id', schoolId)
    .eq('kind', kind)
    .eq('status', 'published');

  if (topic === null) {
    query = query.is('topic', null);
  } else {
    query = query.eq('topic', topic);
  }

  const { data } = await query.single();
  return data;
}

async function getExistingDraftSummary(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  schoolId: string,
  kind: string,
  topic: string | null = null
) {
  let query = supabase
    .from('school_ai_summaries')
    .select('id, summary_text, meta_title, meta_description, reviews_count_used, status')
    .eq('school_id', schoolId)
    .eq('kind', kind)
    .eq('status', 'draft');

  if (topic === null) {
    query = query.is('topic', null);
  } else {
    query = query.eq('topic', topic);
  }

  const { data } = await query.single();
  return data;
}

async function saveSummary(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  schoolId: string,
  kind: string,
  topic: string | null,
  summaryText: string,
  metaTitle: string | null,
  metaDescription: string | null,
  reviewsCountUsed: number,
  publish: boolean,
  maxCreatedAt: string | null = null
): Promise<{ id: string; skippedPublished: boolean }> {
  // published済みが存在する場合は上書きしない（目検の方が精度が高いため）
  const existingPublished = await getExistingPublishedSummary(supabase, schoolId, kind, topic);
  if (existingPublished) {
    return { id: existingPublished.id, skippedPublished: true };
  }

  const status = publish ? 'published' : 'draft';
  const existing = await getExistingDraftSummary(supabase, schoolId, kind, topic);

  const payload = {
    school_id: schoolId,
    kind,
    topic,
    status,
    summary_text: summaryText,
    meta_title: metaTitle,
    meta_description: metaDescription,
    reviews_count_used: reviewsCountUsed,
    source_signature: sourceSignature(reviewsCountUsed, maxCreatedAt),
    generated_at: new Date().toISOString(),
    created_by: null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw new Error(`要約保存エラー: ${error.message}`);
    return { id: data?.id || existing.id, skippedPublished: false };
  } else {
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(`要約作成エラー: ${error.message}`);
    return { id: data?.id || '', skippedPublished: false };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;
    const body = await request.json();

    const steps: StepName[] = body.steps && Array.isArray(body.steps) ? body.steps : ALL_STEPS;
    const publish: boolean = body.publish ?? false;
    const deltaThreshold: number = body.review_delta_threshold ?? 5;
    const dryRun: boolean = body.dry_run ?? false;

    const supabase = createAdminSupabaseClient();

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug, status')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });
    }

    const reviewCount = await getPublicReviewCount(supabase, schoolId);
    const alerts: Alert[] = [];
    const results: Record<string, StepResult> = {};
    let totalOpenAITokens = 0;
    let totalPerplexityTokens = 0;

    // --- A2: slug（口コミ不要のため no_reviews チェックより前に実行）---
    if (steps.includes('slug')) {
      // ASCII-only なスラグが既にある場合はスキップ（手動設定済みを保護）
      if (school.slug && !hasJapaneseSlug(school.slug)) {
        results.slug = { status: 'skipped', reason: 'already_set', value: school.slug };
      } else {
        try {
          let slug = await callOpenAIForSlug(school.name);
          totalOpenAITokens += 80;
          const { data: conflict } = await supabase
            .from('schools')
            .select('id')
            .eq('slug', slug)
            .neq('id', schoolId)
            .single();

          if (conflict) {
            slug = `${slug}-${schoolId.slice(0, 6)}`;
            alerts.push({
              code: 'ALERT-07',
              message: `slug 重複のためサフィックス付与: ${slug}`,
              severity: 'info',
            });
          }

          if (!dryRun) {
            await supabase.from('schools').update({ slug }).eq('id', schoolId);
          }
          results.slug = { status: 'ok', value: slug };
        } catch (e) {
          results.slug = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- A1: prefecture（口コミ不要。slug と同様、no_reviews 早期リターンより前で実行）---
    if (steps.includes('prefecture')) {
      if (school.prefecture) {
        results.prefecture = { status: 'skipped', reason: 'already_set', value: school.prefecture };
      } else {
        try {
          const prefResult = await callOpenAIForPrefecture(school.name);
          totalOpenAITokens += 200;

          if (prefResult.confidence === 'low') {
            results.prefecture = { status: 'skipped', reason: 'low_confidence', value: prefResult.prefecture, confidence: prefResult.confidence };
          } else {
            if (!VALID_PREFECTURES.includes(prefResult.prefecture)) {
              results.prefecture = { status: 'error', reason: `無効な都道府県: ${prefResult.prefecture}` };
            } else {
              if (!dryRun) {
                await supabase.from('schools').update({
                  prefecture: prefResult.prefecture,
                  prefectures: [prefResult.prefecture],
                }).eq('id', schoolId);
              }
              results.prefecture = { status: 'ok', value: prefResult.prefecture, confidence: prefResult.confidence };

              if (prefResult.confidence === 'medium') {
                alerts.push({
                  code: 'ALERT-05',
                  message: `都道府県「${prefResult.prefecture}」confidence: medium（${prefResult.reasoning}）`,
                  severity: 'warning',
                });
              }
            }
          }

          if (!school.name.includes('高等学校')) {
            alerts.push({
              code: 'ALERT-11',
              message: '学校名に「高等学校」が含まれない（推定精度低下リスク）',
              severity: 'info',
            });
          }
        } catch (e) {
          results.prefecture = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    if (reviewCount === 0) {
      for (const step of steps) {
        if (!(step in results)) {
          results[step] = { status: 'skipped', reason: 'no_reviews' };
        }
      }
      return NextResponse.json({
        school_id: schoolId,
        school_name: school.name,
        review_count: 0,
        results,
        alerts,
        tokens_used: { openai: totalOpenAITokens, perplexity: 0 },
      });
    }

    // --- A3: intro (Perplexity → schools.intro) ---
    if (steps.includes('intro')) {
      const { data: schoolForIntro } = await supabase
        .from('schools')
        .select('intro')
        .eq('id', schoolId)
        .single();

      if (schoolForIntro?.intro && schoolForIntro.intro.trim().length > 0) {
        results.intro = { status: 'skipped', reason: 'already_set', value: `${schoolForIntro.intro.length}字` };
      } else {
        try {
          const perplexityResult = await callPerplexityForSummary(school.name);
          totalPerplexityTokens += perplexityResult.tokensUsed.total;

          const text = perplexityResult.summaryText;
          if (text.length < 150 || text.length > 300) {
            alerts.push({
              code: 'ALERT-06',
              message: `intro が ${text.length}文字（目標200字前後）`,
              severity: 'warning',
            });
          }

          if (!dryRun) {
            await supabase.from('schools').update({ intro: text }).eq('id', schoolId);
          }

          results.intro = {
            status: 'ok',
            value: `${text.length}字`,
            citations: perplexityResult.citations,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          alerts.push({ code: 'ALERT-15', message: `公式サイト検索失敗: ${msg}`, severity: 'error' });
          results.intro = { status: 'error', reason: msg };
        }
      }
    }

    // --- 口コミデータの事前取得（summary, meta, SEO, FAQ, 傾向で共有） ---
    const allReviews = await getPublicReviews(supabase, schoolId);
    const maxCreatedAt = allReviews.length > 0
      ? allReviews.reduce((max, r) => (r.created_at > max ? r.created_at : max), allReviews[0].created_at)
      : null;
    const reviewsForGen = allReviews.map((r) => ({
      good_comment: r.good_comment || '',
      bad_comment: r.bad_comment || '',
      overall_satisfaction: r.overall_satisfaction || 0,
      answers: r.answers as Record<string, unknown> | undefined,
    }));

    // --- A4: summary (OpenAI 口コミ要約 → school_ai_summaries.summary_text) ---
    if (steps.includes('summary')) {
      const existingOverall = await getExistingPublishedSummary(supabase, schoolId, 'overall');
      const existingDraft = await getExistingDraftSummary(supabase, schoolId, 'overall');
      const hasSummary = (existingOverall?.summary_text && existingOverall.summary_text.trim().length > 0)
        || (existingDraft?.summary_text && existingDraft.summary_text.trim().length > 0);

      if (hasSummary) {
        results.summary = { status: 'skipped', reason: 'already_set' };
      } else {
        try {
          if (allReviews.length === 0) {
            results.summary = { status: 'skipped', reason: 'no_reviews' };
          } else {
            const summaryResult = await callOpenAIForSummary(
              school.name,
              allReviews.map((r) => ({
                good_comment: r.good_comment || '',
                bad_comment: r.bad_comment || '',
                overall_satisfaction: r.overall_satisfaction || 0,
              }))
            );
            totalOpenAITokens += summaryResult.tokensUsed.total;

            const text = summaryResult.summaryText;

            if (!dryRun) {
              await saveSummary(
                supabase, schoolId, 'overall', null,
                text,
                existingOverall?.meta_title || existingDraft?.meta_title || null,
                existingOverall?.meta_description || existingDraft?.meta_description || null,
                reviewCount, publish, maxCreatedAt
              );
            }

            results.summary = { status: 'ok', value: `${text.length}字` };
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.summary = { status: 'error', reason: msg };
        }
      }
    }

    // --- A5-A6: meta_title / meta_description ---
    if (steps.includes('meta')) {
      const existingOverallForMeta = await getExistingPublishedSummary(supabase, schoolId, 'overall');
      const existingDraftForMeta = await getExistingDraftSummary(supabase, schoolId, 'overall');
      const hasMeta = existingOverallForMeta?.meta_title || existingDraftForMeta?.meta_title;

      if (hasMeta) {
        results.meta = { status: 'skipped', reason: 'already_set' };
      } else {
        try {
          const metaResult = await callOpenAIForMeta(
            school.name,
            allReviews.slice(0, 30).map((r) => ({
              good_comment: r.good_comment || '',
              bad_comment: r.bad_comment || '',
              overall_satisfaction: r.overall_satisfaction || 0,
            }))
          );
          totalOpenAITokens += metaResult.tokensUsed.total;
          alerts.push(...metaResult.alerts);

          if (!dryRun) {
            if (existingDraftForMeta?.id) {
              // draftレコードにmeta情報を追記（publishedは触らない）
              await supabase.from('school_ai_summaries').update({
                meta_title: metaResult.metaTitle,
                meta_description: metaResult.metaDescription,
                reviews_count_used: reviewCount,
              }).eq('id', existingDraftForMeta.id);
            } else {
              // draftもpublishedもない場合のみ新規作成
              await saveSummary(
                supabase, schoolId, 'overall', null,
                '',
                metaResult.metaTitle,
                metaResult.metaDescription,
                reviewCount, publish, maxCreatedAt
              );
            }
          }

          results.meta = {
            status: 'ok',
            meta_title: metaResult.metaTitle,
            meta_title_length: metaResult.metaTitle.length,
            meta_description_length: metaResult.metaDescription.length,
          };
        } catch (e) {
          results.meta = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- B1-B5: SEO sections ---
    if (steps.includes('seo_sections')) {
      if (reviewCount < 1) {
        results.seo_sections = { status: 'skipped', reason: 'no_reviews' };
      } else {
        // published済みのtopicを特定し、それ以外のみ生成対象にする
        const { data: existingSeoAll } = await supabase
          .from('school_ai_summaries')
          .select('topic, status, reviews_count_used')
          .eq('school_id', schoolId)
          .eq('kind', 'seo')
          .in('topic', [...SEO_SECTION_KEYS]);

        const publishedTopics = new Set(
          (existingSeoAll || []).filter((s: any) => s.status === 'published').map((s: any) => s.topic)
        );
        const keysToGenerate = SEO_SECTION_KEYS.filter((k) => !publishedTopics.has(k));

        if (keysToGenerate.length === 0) {
          results.seo_sections = { status: 'skipped', reason: 'all_published', sections_published: publishedTopics.size };
        } else {
          if (reviewCount <= 2) {
            alerts.push({
              code: 'ALERT-12',
              message: `口コミ${reviewCount}件でSEOセクション生成。精度が低い可能性`,
              severity: 'info',
            });
          }
          try {
            let sectionsOk = 0;
            const skippedKeys: string[] = [];
            for (const key of keysToGenerate) {
              const seoResult = await callOpenAIForSeoSection(school.name, key, reviewsForGen);
              totalOpenAITokens += seoResult.tokensUsed.total;

              const textLen = seoResult.summaryText.length;
              if (textLen < 200 || textLen > 400) {
                alerts.push({
                  code: 'ALERT-08',
                  message: `SEO「${key}」が ${textLen}文字（目標200-400）`,
                  severity: 'warning',
                });
              }

              if (!dryRun) {
                await saveSummary(supabase, schoolId, 'seo', key, seoResult.summaryText, null, null, reviewCount, publish, maxCreatedAt);
              }
              sectionsOk++;
            }
            results.seo_sections = {
              status: 'ok',
              sections_count: sectionsOk,
              sections_skipped_published: publishedTopics.size,
            };
          } catch (e) {
            results.seo_sections = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
          }
        }
      }
    }

    // --- B6: FAQ ---
    if (steps.includes('faq')) {
      const existingFaqPublished = await getExistingPublishedSummary(supabase, schoolId, 'seo', 'faq');

      if (existingFaqPublished) {
        results.faq = { status: 'skipped', reason: 'already_published' };
      } else if (reviewCount < 1) {
        results.faq = { status: 'skipped', reason: 'no_reviews' };
      } else {
        try {
          const faqResult = await callOpenAIForFaq(school.name, reviewsForGen);
          totalOpenAITokens += faqResult.tokensUsed.total;

          for (const item of faqResult.items) {
            if (item.answer.length < 80 || item.answer.length > 150) {
              alerts.push({
                code: 'ALERT-09',
                message: `FAQ「${item.question.slice(0, 20)}...」回答が ${item.answer.length}文字（目標80-150）`,
                severity: 'warning',
              });
            }
          }

          if (!dryRun) {
            await saveSummary(
              supabase, schoolId, 'seo', 'faq',
              JSON.stringify(faqResult.items),
              null, null, reviewCount, publish, maxCreatedAt
            );
          }
          results.faq = { status: 'ok', items_count: faqResult.items.length };
        } catch (e) {
          results.faq = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- B7: review_tendency (school_ai_summaries kind='review_tendency') ---
    if (steps.includes('review_tendency')) {
      const existingTendPublished = await getExistingPublishedSummary(supabase, schoolId, 'review_tendency');

      if (existingTendPublished) {
        results.review_tendency = { status: 'skipped', reason: 'already_published' };
      } else if (reviewCount < 1) {
        results.review_tendency = { status: 'skipped', reason: 'no_reviews' };
      } else {
        if (reviewCount <= 2) {
          alerts.push({
            code: 'ALERT-12',
            message: `口コミ${reviewCount}件で口コミ傾向生成。精度が低い可能性`,
            severity: 'info',
          });
        }
        try {
          const tendResult = await callOpenAIForReviewTendency(school.name, reviewsForGen);
          totalOpenAITokens += tendResult.tokensUsed.total;

          const allPoints = [...tendResult.summary.good_points, ...tendResult.summary.improvement_points];
          for (const point of allPoints) {
            if (point.length < 40 || point.length > 80) {
              alerts.push({
                code: 'ALERT-10',
                message: `口コミ傾向「${point.slice(0, 20)}...」が ${point.length}文字（目標40-80）`,
                severity: 'warning',
              });
            }
          }

          if (!dryRun) {
            await saveSummary(
              supabase, schoolId, 'review_tendency', null,
              JSON.stringify(tendResult.summary),
              null, null, reviewCount, publish, maxCreatedAt
            );
          }
          results.review_tendency = { status: 'ok' };
        } catch (e) {
          results.review_tendency = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- publish overall if requested (published済みがなければdraftを昇格) ---
    if (publish && !dryRun) {
      const existingOverallPublished = await getExistingPublishedSummary(supabase, schoolId, 'overall');
      if (!existingOverallPublished) {
        const { data: draftOverall } = await supabase
          .from('school_ai_summaries')
          .select('id')
          .eq('school_id', schoolId)
          .eq('kind', 'overall')
          .is('topic', null)
          .eq('status', 'draft')
          .single();

        if (draftOverall) {
          await supabase
            .from('school_ai_summaries')
            .update({ status: 'published' })
            .eq('id', draftOverall.id);
        }
      }
    }

    return NextResponse.json({
      school_id: schoolId,
      school_name: school.name,
      review_count: reviewCount,
      results,
      alerts,
      tokens_used: { openai: totalOpenAITokens, perplexity: totalPerplexityTokens },
    });
  } catch (error) {
    console.error('Agent setup API エラー:', error);
    return NextResponse.json(
      { error: 'エージェントセットアップに失敗しました', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
