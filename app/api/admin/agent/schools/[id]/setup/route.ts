import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { generateSlug } from '@/lib/utils';
import { callOpenAIForPrefecture, callOpenAIForMeta, callOpenAIForSummary, type MetaGenerationAlert } from '@/lib/openai/client';
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
) {
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

  if (publish) {
    let unpublishQuery = supabase
      .from('school_ai_summaries')
      .update({ status: 'draft' })
      .eq('school_id', schoolId)
      .eq('kind', kind)
      .eq('status', 'published');
    unpublishQuery = topic === null ? unpublishQuery.is('topic', null) : unpublishQuery.eq('topic', topic);
    await unpublishQuery;
  }

  if (existing) {
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw new Error(`要約保存エラー: ${error.message}`);
    return data?.id;
  } else {
    const { data, error } = await supabase
      .from('school_ai_summaries')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(`要約作成エラー: ${error.message}`);
    return data?.id;
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

    if (reviewCount === 0) {
      for (const step of steps) {
        results[step] = { status: 'skipped', reason: 'no_reviews' };
      }
      return NextResponse.json({
        school_id: schoolId,
        school_name: school.name,
        review_count: 0,
        results,
        alerts,
        tokens_used: { openai: 0, perplexity: 0 },
      });
    }

    // --- A1: prefecture ---
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

    // --- A2: slug ---
    if (steps.includes('slug')) {
      if (school.slug) {
        results.slug = { status: 'skipped', reason: 'already_set', value: school.slug };
      } else {
        let slug = generateSlug(school.name);
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
      }
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
          const reviews = await getPublicReviews(supabase, schoolId);
          if (reviews.length === 0) {
            results.summary = { status: 'skipped', reason: 'no_reviews' };
          } else {
            const summaryResult = await callOpenAIForSummary(
              school.name,
              reviews.map((r) => ({
                good_comment: r.good_comment || '',
                bad_comment: r.bad_comment || '',
                overall_satisfaction: r.overall_satisfaction || 0,
              }))
            );
            totalOpenAITokens += summaryResult.tokensUsed.total;

            const text = summaryResult.summaryText;

            if (!dryRun) {
              const targetId = existingDraft?.id || existingOverall?.id;
              if (targetId) {
                await supabase.from('school_ai_summaries').update({
                  summary_text: text,
                  reviews_count_used: reviewCount,
                  source_signature: sourceSignature(reviewCount, reviews[0]?.created_at || null),
                  generated_at: new Date().toISOString(),
                }).eq('id', targetId);
              } else {
                await supabase.from('school_ai_summaries').insert({
                  school_id: schoolId,
                  kind: 'overall',
                  topic: null,
                  status: 'draft',
                  summary_text: text,
                  meta_title: null,
                  meta_description: null,
                  reviews_count_used: reviewCount,
                  source_signature: sourceSignature(reviewCount, reviews[0]?.created_at || null),
                  generated_at: new Date().toISOString(),
                  created_by: null,
                });
              }
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
      const existingOverall = await getExistingPublishedSummary(supabase, schoolId, 'overall');
      const existingDraft = await getExistingDraftSummary(supabase, schoolId, 'overall');
      const hasMeta = existingOverall?.meta_title || existingDraft?.meta_title;

      if (hasMeta) {
        results.meta = { status: 'skipped', reason: 'already_set' };
      } else {
        try {
          const reviews = await getPublicReviews(supabase, schoolId, 30);
          const metaResult = await callOpenAIForMeta(
            school.name,
            reviews.map((r) => ({
              good_comment: r.good_comment || '',
              bad_comment: r.bad_comment || '',
              overall_satisfaction: r.overall_satisfaction || 0,
            }))
          );
          totalOpenAITokens += metaResult.tokensUsed.total;
          alerts.push(...metaResult.alerts);

          if (!dryRun) {
            const targetId = existingDraft?.id || existingOverall?.id;
            if (targetId) {
              await supabase.from('school_ai_summaries').update({
                meta_title: metaResult.metaTitle,
                meta_description: metaResult.metaDescription,
                reviews_count_used: reviewCount,
              }).eq('id', targetId);
            } else {
              await supabase.from('school_ai_summaries').insert({
                school_id: schoolId,
                kind: 'overall',
                topic: null,
                status: 'draft',
                summary_text: '',
                meta_title: metaResult.metaTitle,
                meta_description: metaResult.metaDescription,
                reviews_count_used: reviewCount,
                source_signature: sourceSignature(reviewCount, null),
                generated_at: new Date().toISOString(),
                created_by: null,
              });
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

    // --- Group B: 口コミ増分判定 ---
    const existingPublished = await getExistingPublishedSummary(supabase, schoolId, 'overall');
    const lastUsedCount = existingPublished?.reviews_count_used ?? 0;
    const delta = reviewCount - lastUsedCount;
    const isFirstRunB = !existingPublished || lastUsedCount === 0;
    const shouldRunB = reviewCount >= 3 && (isFirstRunB || delta >= deltaThreshold);

    if (reviewCount >= 3 && !isFirstRunB && delta >= deltaThreshold) {
      alerts.push({
        code: 'ALERT-13',
        message: `既存の公開済みコンテンツを再生成（口コミ増分: ${delta}件）`,
        severity: 'info',
      });
    }
    if (reviewCount >= 3 && reviewCount <= 5 && shouldRunB) {
      alerts.push({
        code: 'ALERT-12',
        message: `口コミ${reviewCount}件で生成。精度が低い可能性`,
        severity: 'info',
      });
    }

    const reviews = shouldRunB ? await getPublicReviews(supabase, schoolId) : [];
    const maxCreatedAt = reviews.length > 0
      ? reviews.reduce((max, r) => (r.created_at > max ? r.created_at : max), reviews[0].created_at)
      : null;
    const reviewsForGen = reviews.map((r) => ({
      good_comment: r.good_comment || '',
      bad_comment: r.bad_comment || '',
      overall_satisfaction: r.overall_satisfaction || 0,
      answers: r.answers as Record<string, unknown> | undefined,
    }));

    // --- B1-B5: SEO sections ---
    if (steps.includes('seo_sections')) {
      if (!shouldRunB) {
        results.seo_sections = {
          status: 'skipped',
          reason: reviewCount < 3 ? 'insufficient_reviews' : 'delta_insufficient',
          delta,
        };
      } else {
        try {
          let sectionsOk = 0;
          for (const key of SEO_SECTION_KEYS) {
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
          results.seo_sections = { status: 'ok', sections_count: sectionsOk, review_delta: delta };
        } catch (e) {
          results.seo_sections = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- B6: FAQ ---
    if (steps.includes('faq')) {
      if (!shouldRunB) {
        results.faq = {
          status: 'skipped',
          reason: reviewCount < 3 ? 'insufficient_reviews' : 'delta_insufficient',
          delta,
        };
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

    // --- B7: review_tendency ---
    if (steps.includes('review_tendency')) {
      if (!shouldRunB) {
        results.review_tendency = {
          status: 'skipped',
          reason: reviewCount < 3 ? 'insufficient_reviews' : 'delta_insufficient',
          delta,
        };
      } else {
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
            const { data: existingTendency } = await supabase
              .from('review_tendency')
              .select('id')
              .eq('school_id', schoolId)
              .eq('status', 'draft')
              .single();

            const tendencyPayload = {
              school_id: schoolId,
              status: publish ? 'published' : 'draft',
              summary_text: JSON.stringify(tendResult.summary),
              reviews_count_used: reviewCount,
              generated_at: new Date().toISOString(),
            };

            if (publish) {
              await supabase
                .from('review_tendency')
                .update({ status: 'draft' })
                .eq('school_id', schoolId)
                .eq('status', 'published');
            }

            if (existingTendency) {
              await supabase.from('review_tendency').update(tendencyPayload).eq('id', existingTendency.id);
            } else {
              await supabase.from('review_tendency').insert(tendencyPayload);
            }
          }
          results.review_tendency = { status: 'ok' };
        } catch (e) {
          results.review_tendency = { status: 'error', reason: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // --- publish overall if requested ---
    if (publish && !dryRun) {
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
          .update({ status: 'draft' })
          .eq('school_id', schoolId)
          .eq('kind', 'overall')
          .is('topic', null)
          .eq('status', 'published');

        await supabase
          .from('school_ai_summaries')
          .update({ status: 'published' })
          .eq('id', draftOverall.id);
      }
    }

    return NextResponse.json({
      school_id: schoolId,
      school_name: school.name,
      review_count: reviewCount,
      review_delta: delta,
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
