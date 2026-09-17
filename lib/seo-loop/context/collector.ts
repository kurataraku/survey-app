import type { SupabaseClient } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/env-check';
import { getDecliningSchoolMetaOverride } from '@/lib/schools/declining-school-meta';
import { getGscPrioritySchoolMetaOverride } from '@/lib/seo/gsc-priority-school-meta';
import { payloadHash } from '../hash';
import { fetchHtmlFacts, identifyPageUrl } from './html';
import type { DatabaseFactSnapshot, FactContextSnapshot } from './types';

async function collectSchoolDatabaseFacts(
  supabase: SupabaseClient,
  slug: string
): Promise<Exclude<DatabaseFactSnapshot, null>> {
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id,name,slug,is_public')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();
  if (schoolError || !school) {
    throw new Error(`公開学校を特定できません: ${slug}`);
  }

  const { data: summary, error: summaryError } = await supabase
    .from('school_ai_summaries')
    .select('summary_text,meta_title,meta_description')
    .eq('school_id', school.id)
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'published')
    .maybeSingle();
  if (summaryError) throw summaryError;

  return {
    type: 'school',
    id: String(school.id),
    name: String(school.name),
    slug: String(school.slug),
    isPublic: Boolean(school.is_public),
    aiSummary: summary
      ? {
          summaryText: summary.summary_text ?? null,
          metaTitle: summary.meta_title ?? null,
          metaDescription: summary.meta_description ?? null,
        }
      : null,
  };
}

async function collectFeatureDatabaseFacts(
  supabase: SupabaseClient,
  slug: string
): Promise<Exclude<DatabaseFactSnapshot, null>> {
  const { data: article, error } = await supabase
    .from('articles')
    .select('id,title,slug,is_public,meta_title,meta_description')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();
  if (error || !article) {
    throw new Error(`公開特集を特定できません: ${slug}`);
  }

  return {
    type: 'feature',
    id: String(article.id),
    title: String(article.title),
    slug: String(article.slug),
    isPublic: Boolean(article.is_public),
    metaTitle: article.meta_title ?? null,
    metaDescription: article.meta_description ?? null,
  };
}

export async function collectFactContext(params: {
  supabase: SupabaseClient;
  targetUrl: string;
  siteUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<FactContextSnapshot> {
  const siteUrl = params.siteUrl ?? getSiteUrl();
  if (!siteUrl || siteUrl === 'https://example.com') {
    throw new Error('Fact収集には正しいNEXT_PUBLIC_SITE_URLが必要です');
  }

  const identity = identifyPageUrl(params.targetUrl, siteUrl);
  if (!identity.slug || identity.pageType === 'other') {
    throw new Error(`未対応のページ種別です: ${identity.pageType}`);
  }

  const [html, database] = await Promise.all([
    fetchHtmlFacts(identity.url, params.fetchImpl),
    identity.pageType === 'school'
      ? collectSchoolDatabaseFacts(params.supabase, identity.slug)
      : collectFeatureDatabaseFacts(params.supabase, identity.slug),
  ]);

  const currentValues: FactContextSnapshot['currentValues'] = {
    addApprovedInternalLink: `links:${html.internalLinks.length}:sha256:${payloadHash(html.internalLinks)}`,
  };
  if (database.type === 'school') {
    const hasCodeOverride = Boolean(
      getDecliningSchoolMetaOverride(database.slug) ||
        getGscPrioritySchoolMetaOverride(database.slug)
    );
    if (!hasCodeOverride && database.aiSummary?.metaTitle != null) {
      currentValues.updateSchoolMetaTitle = database.aiSummary.metaTitle;
    }
    if (database.aiSummary?.summaryText !== null && database.aiSummary?.summaryText !== undefined) {
      currentValues.updateSeoSummary = database.aiSummary.summaryText;
    }
  } else if (database.metaDescription !== null) {
    currentValues.updateFeatureMetaDescription = database.metaDescription;
  }

  return {
    version: 1,
    collectedAt: (params.now ?? (() => new Date()))().toISOString(),
    target: {
      ...identity,
      id: database.id,
    },
    html,
    database,
    currentValues,
  };
}
