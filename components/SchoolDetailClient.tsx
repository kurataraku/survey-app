'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2, XCircle, User, ChevronDown, School, Bus } from 'lucide-react';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import SchoolRadarChart from '@/components/SchoolRadarChart';
import { getQuestionLabel } from '@/lib/questionLabels';
import SchoolSummary from '@/components/SchoolSummary';
import Tabs from '@/components/ui/Tabs';
import StatisticsSection from '@/components/StatisticsSection';
import { SchoolWithStats } from '@/lib/schools/getSchoolWithStats';
import { appPath } from '@/lib/base-path';
import { SEO_SECTION_KEYS, SEO_SECTION_LABELS, FAQ_OLD_TO_NEW, FAQ_DISPLAY_ORDER } from '@/lib/seo-sections';
import type { ParsedAiSummarySections } from '@/lib/schools/parseAiSummarySections';
import {
  sliceSummaryForFv,
  stripAiSummaryDisclaimer,
  stripTuitionCommuteMarkdownSection,
} from '@/lib/schools/parseAiSummarySections';
import { MIN_REVIEW_COUNT_FOR_TUITION_COMMUTE_TREND } from '@/lib/schools/review-display-thresholds';
import {
  SCHOOL_REVIEWS_LIST_CTA_SUBTITLE,
  SCHOOL_REVIEWS_LIST_CTA_TITLE,
} from '@/lib/schools/school-reviews-list-copy';
import SurveyCtaLink from '@/components/SurveyCtaLink';
import ThemeHubNav from '@/components/ThemeHubNav';
import RequestNotificationCta from '@/components/RequestNotificationCta';
import TuitionEstimateBlock from '@/components/TuitionEstimateBlock';
import TuitionDisclaimer from '@/components/TuitionDisclaimer';
import CourseListBlock from '@/components/CourseListBlock';
import { hasDisplayableTuition } from '@/lib/tuition/format';
import { GA_EVENTS } from '@/lib/analytics/events';
import { getPrefecturePath } from '@/lib/prefectures';

const CONCLUSION_MAX_CHARS = 350;
const DECISION_LEAD_MAX_CHARS = 300;
const FEW_REVIEWS_THRESHOLD = 5;
/** 学費の納得感ブロックで「参考情報」注記を出す口コミ件数の上限 */
const TUITION_SATISFACTION_FEW_REVIEWS_MAX = 3;
const GRAPH_HIDDEN_THRESHOLD = 1;

/** セクション末尾に置く口コミ一覧への軽量導線（長いページの途中離脱を防ぐ） */
function ReviewsListInlineLink({
  encodedSlug,
  label = '口コミ一覧を見る',
}: {
  encodedSlug: string;
  label?: string;
}) {
  return (
    <div className="mt-5 pt-3 border-t border-gray-100 text-right">
      <Link
        href={appPath(`/schools/${encodedSlug}/reviews`)}
        className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
      >
        {label}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

function SchoolHubReviewsListCta({ encodedSlug }: { encodedSlug: string }) {
  return (
    <Link
      href={appPath(`/schools/${encodedSlug}/reviews`)}
      className="inline-flex w-full flex-col items-center justify-center gap-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 text-sm shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200"
      aria-label={`${SCHOOL_REVIEWS_LIST_CTA_TITLE}。${SCHOOL_REVIEWS_LIST_CTA_SUBTITLE}`}
    >
      <span className="font-semibold">{SCHOOL_REVIEWS_LIST_CTA_TITLE}</span>
      <span className="text-xs font-normal text-white/90 leading-snug text-center">
        {SCHOOL_REVIEWS_LIST_CTA_SUBTITLE}
      </span>
    </Link>
  );
}

function getRatingComparison(value: number | null | undefined, globalValue: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  if (globalValue == null || Number.isNaN(globalValue)) return null;
  const diff = Math.round((value - globalValue) * 10) / 10;
  if (Math.abs(diff) < 0.05) return 'サイト全体の平均とほぼ同水準です。';
  return diff > 0
    ? `サイト全体の平均より${diff.toFixed(1)}高めです。`
    : `サイト全体の平均より${Math.abs(diff).toFixed(1)}低めです。`;
}

function getTopEntries(record: Record<string, number> | undefined, limit = 3) {
  return Object.entries(record ?? {})
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function formatPercentage(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function ResponseDistributionCard({
  title,
  items,
  total,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  total: number;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
          口コミ回答者ベース
        </span>
      </div>
      <div className="space-y-3">
        {items.map(({ label, count }) => {
          const percentage = formatPercentage(count, total);
          return (
            <div key={label}>
              <div className="flex items-start justify-between gap-3 text-sm text-gray-700 mb-1">
                <span className="leading-snug">{label}</span>
                <span className="shrink-0 font-semibold text-gray-900">{percentage}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white overflow-hidden ring-1 ring-inset ring-blue-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${percentage}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">回答者の{percentage}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SchoolDetailClientProps {
  school: SchoolWithStats;
  encodedSlug: string;
  parsedAiSummary: ParsedAiSummarySections;
  tuitionAttendStatsHint: string | null;
  relatedSchools?: React.ReactNode;
  children?: React.ReactNode;
}

export default function SchoolDetailClient({
  school,
  encodedSlug,
  parsedAiSummary,
  tuitionAttendStatsHint,
  relatedSchools,
  children,
}: SchoolDetailClientProps) {
  const [expandedSeoContent, setExpandedSeoContent] = useState<Record<string, boolean>>({});
  const [openSeoAccordion, setOpenSeoAccordion] = useState<Record<string, boolean>>({});
  const [graphActiveTab, setGraphActiveTab] = useState<'ratings' | 'statistics'>('ratings');

  /** FAQをユーザー関心順に並べ、旧質問文を新表示文に差し替え */
  const faqItemsForDisplay = useMemo(() => {
    if (!school.faq_items?.length) return [];
    return [...school.faq_items]
      .map((item) => ({
        ...item,
        displayQuestion: FAQ_OLD_TO_NEW[item.question] ?? item.question,
      }))
      .sort((a, b) => {
        const ia = FAQ_DISPLAY_ORDER.indexOf(a.displayQuestion);
        const ib = FAQ_DISPLAY_ORDER.indexOf(b.displayQuestion);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
  }, [school.faq_items]);

  const emptySeoOrFaqHint =
    school.review_count === 0
      ? '学校概要や公式サイトの最新情報とあわせてご確認ください。'
      : 'まだ口コミが十分に集まっていません。';

  useEffect(() => {
    const syncTabFromHash = () => {
      if (typeof window === 'undefined') return;
      if (window.location.hash === '#section-trends') setGraphActiveTab('statistics');
      else if (window.location.hash === '#section-ratings') setGraphActiveTab('ratings');
    };
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fvSummary = useMemo(() => sliceSummaryForFv(parsedAiSummary, 4), [parsedAiSummary]);
  const showTuitionCommuteTrend = school.review_count >= MIN_REVIEW_COUNT_FOR_TUITION_COMMUTE_TREND;
  const decisionLeadTruncated = useMemo(() => {
    const t = parsedAiSummary.overviewPlain.trim();
    if (!t) return null;
    if (t.length <= DECISION_LEAD_MAX_CHARS) return t;
    return `${t.slice(0, DECISION_LEAD_MAX_CHARS).trim()}…`;
  }, [parsedAiSummary.overviewPlain]);
  const topAttendance = useMemo(
    () => getTopEntries(school.statistics?.attendance_frequency, 3),
    [school.statistics?.attendance_frequency]
  );
  const topTeachingStyles = useMemo(
    () => getTopEntries(school.statistics?.teaching_style, 3),
    [school.statistics?.teaching_style]
  );
  const topStudentAtmosphere = useMemo(
    () => getTopEntries(school.statistics?.student_atmosphere, 3),
    [school.statistics?.student_atmosphere]
  );
  const topReasons = useMemo(
    () => getTopEntries(school.statistics?.reason_for_choosing, 3),
    [school.statistics?.reason_for_choosing]
  );
  const tuitionComparison = getRatingComparison(
    school.tuition_rating_avg,
    school.global_averages?.tuition_rating_avg
  );
  const goodBadSeo = school.seo_sections?.good_bad;
  const tuitionSeo = school.seo_sections?.tuition;
  const syllabusSeo = school.seo_sections?.syllabus;
  const learningSeo = school.seo_sections?.learning;
  const flexibilitySeo = school.seo_sections?.flexibility;

  return (
    <>
      {/* 結論サマリー */}
      <SchoolSummary
        name={school.name}
        prefecture={school.prefecture}
        prefectures={school.prefectures || undefined}
        campusLocations={school.campus_locations}
        slug={encodedSlug}
        overallAvg={school.overall_avg}
        reviewCount={school.review_count}
        staffRatingAvg={school.staff_rating_avg}
        atmosphereFitRatingAvg={school.atmosphere_fit_rating_avg}
        creditRatingAvg={school.credit_rating_avg}
        latestReviews={school.latest_reviews}
        decisionLead={decisionLeadTruncated}
        fitsBullets={fvSummary.fitsBullets}
        notFitsBullets={fvSummary.notFitsBullets}
        tuitionCommuteBullets={
          showTuitionCommuteTrend ? fvSummary.tuitionCommuteBullets.slice(0, 3) : []
        }
        tuitionAttendStatsHint={showTuitionCommuteTrend ? tuitionAttendStatsHint : null}
        globalAverages={school.global_averages}
      />

      {(school.intro ||
        (school.review_count === 0 && school.prefecture && school.prefecture !== '不明')) && (
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <School className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">学校概要</h2>
          </div>
          {school.intro ? (
            <p className="text-sm text-gray-700 leading-relaxed">{school.intro}</p>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              掲載中の学校紹介文はまだありません。公式サイトで概要を確認するか、下の「評判の詳細・よくある質問」をご覧ください。
            </p>
          )}
          {school.prefecture && school.prefecture !== '不明' && (
            <p className="mt-4 text-sm">
              <Link
                href={appPath(getPrefecturePath(school.prefecture))}
                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                {school.prefecture}の通信制高校一覧を見る
              </Link>
            </p>
          )}
        </div>
      )}

      {/* 口コミ要約の詳細（FVと役割分担。全文・箇条書きは折りたたみ） */}
      {school.ai_summary && (() => {
        const isFewReviews = school.review_count < FEW_REVIEWS_THRESHOLD;
        const p = parsedAiSummary;
        const hasStructured =
          Boolean(p.overviewPlain) ||
          p.fitsBullets.length > 0 ||
          p.notFitsBullets.length > 0 ||
          (showTuitionCommuteTrend && p.tuitionCommuteBullets.length > 0);
        const rawFallback = stripAiSummaryDisclaimer(school.ai_summary.summary_text).trim();
        const firstH2 = rawFallback.indexOf('\n## ');
        const legacyLead =
          firstH2 === -1 ? rawFallback : rawFallback.slice(0, firstH2).trim();
        const legacyRest = firstH2 === -1 ? '' : rawFallback.slice(firstH2).trimStart();
        const legacyRestForRender = showTuitionCommuteTrend
          ? legacyRest
          : stripTuitionCommuteMarkdownSection(legacyRest);

        const renderBulletList = (items: string[], icon: 'check' | 'x' | 'bus') =>
          items.map((text, index) => (
            <div key={`${icon}-${index}`} className="flex items-start gap-3 mb-2">
              {icon === 'check' && (
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              )}
              {icon === 'x' && <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />}
              {icon === 'bus' && <Bus className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />}
              <span className="flex-1 leading-relaxed text-gray-700">{text}</span>
            </div>
          ));

        const renderLegacyRest = (restText: string) => {
          const lines = restText.split('\n');
          let currentSection: 'good' | 'bad' | 'tuition' | null = null;
          return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '## この学校が合う人' || trimmedLine.startsWith('## この学校が合う人')) {
              currentSection = 'good';
              return (
                <div key={index} className="flex items-start gap-2 mt-6 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 text-lg">この学校が合う人</h3>
                </div>
              );
            }
            if (trimmedLine === '## この学校が合わない人' || trimmedLine.startsWith('## この学校が合わない人')) {
              currentSection = 'bad';
              return (
                <div key={index} className="flex items-start gap-2 mt-6 mb-4">
                  <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 text-lg">この学校が合わない人</h3>
                </div>
              );
            }
            if (
              trimmedLine === '## 学費・通学スタイルの注意点' ||
              trimmedLine.startsWith('## 学費・通学スタイルの注意点')
            ) {
              currentSection = 'tuition';
              return (
                <div key={index} className="flex items-start gap-2 mt-6 mb-4">
                  <Bus className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 text-lg">学費・通学スタイルの注意点</h3>
                </div>
              );
            }
            if (/^[-・*]\s/.test(trimmedLine)) {
              const content = trimmedLine.replace(/^[-・*]\s/, '');
              if (currentSection === 'good' || currentSection === 'bad' || currentSection === 'tuition') {
                const ic = currentSection === 'good' ? 'check' : currentSection === 'bad' ? 'x' : 'bus';
                return (
                  <div key={index} className="flex items-start gap-3 ml-7 mb-2">
                    {ic === 'check' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    {ic === 'x' && <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />}
                    {ic === 'bus' && <Bus className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />}
                    <span className="flex-1 leading-relaxed">{content}</span>
                  </div>
                );
              }
            }
            if (trimmedLine && !trimmedLine.startsWith('##') && !/^[-・*]\s/.test(trimmedLine)) {
              return (
                <p key={index} className="mb-3 last:mb-0 leading-relaxed">
                  {line}
                </p>
              );
            }
            if (!trimmedLine) return <br key={index} />;
            return null;
          });
        };

        const extendedBody = hasStructured ? (
          <div className="mt-4 space-y-6 text-gray-700">
            {p.overviewPlain ? (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">判断材料の全文</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.overviewPlain}</p>
              </div>
            ) : null}
            {p.fitsBullets.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  この学校が合う人（一覧）
                </h3>
                {renderBulletList(p.fitsBullets, 'check')}
              </div>
            )}
            {p.notFitsBullets.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  この学校が合わない人（一覧）
                </h3>
                {renderBulletList(p.notFitsBullets, 'x')}
              </div>
            )}
            {showTuitionCommuteTrend && p.tuitionCommuteBullets.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Bus className="w-5 h-5 text-amber-700" />
                  学費・通学スタイルの注意点（一覧）
                </h3>
                {renderBulletList(p.tuitionCommuteBullets, 'bus')}
              </div>
            )}
          </div>
        ) : legacyRestForRender.length > 0 ? (
          <div className="mt-4 pl-0">{renderLegacyRest(legacyRestForRender)}</div>
        ) : (
          <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">
            {legacyLead.length > CONCLUSION_MAX_CHARS
              ? `${legacyLead.slice(0, CONCLUSION_MAX_CHARS)}…`
              : legacyLead}
          </p>
        );

        const showDetails =
          hasStructured ||
          legacyRestForRender.length > 0 ||
          legacyLead.length > DECISION_LEAD_MAX_CHARS ||
          (decisionLeadTruncated && p.overviewPlain.length > decisionLeadTruncated.length);

        return (
          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 relative overflow-hidden border border-gray-200">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">口コミ要約（詳細）</h2>
            </div>
            <div className="prose prose-sm max-w-prose text-gray-700 leading-relaxed">
              {isFewReviews && school.review_count > 0 && (
                <p className="text-sm text-amber-700 bg-amber-50/80 rounded-lg px-3 py-2 mb-4">
                  口コミは{school.review_count}件のため、傾向の参考としてご覧ください。
                </p>
              )}
              {school.review_count === 0 && (
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 mb-4 border border-slate-200">
                  口コミがまだないため、次の文章は学校の紹介・参考情報です。最終的な判断は公式サイトや説明会でご確認ください。
                </p>
              )}
              {showDetails ? (
                <details className="mt-0">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    要約の全文・箇条書き一覧を開く
                  </summary>
                  {extendedBody}
                </details>
              ) : null}
            </div>
          </div>
        );
      })(      )}

      {/* タブ風アンカーナビ（本文は隠さず、目的の情報へすぐ移動できるようにする） */}
      <nav
        id="page-toc"
        className="sticky top-0 z-20 -mx-4 sm:mx-0 mb-8 border-y border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:rounded-2xl sm:border"
        aria-label="ページ内ナビゲーション"
      >
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a href="#section-featured" className="shrink-0 rounded-full bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm">
            口コミ
          </a>
          <Link
            href={appPath(`/schools/${encodedSlug}/reviews`)}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 font-semibold text-blue-700 ring-1 ring-inset ring-blue-300 hover:bg-blue-50"
          >
            口コミ一覧
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="#section-review-summary" className="shrink-0 rounded-full bg-blue-50 px-4 py-2 font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
            総評
          </a>
          <a href="#section-tuition" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            学費
          </a>
          <a href="#section-attendance" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            通学頻度
          </a>
          <a href="#section-learning-style" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            学習スタイル
          </a>
          <a href="#section-fit" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            向き不向き
          </a>
          <a href="#section-related-schools" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            比較
          </a>
          <a
            href="#section-ratings"
            className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
            onClick={() => setGraphActiveTab('ratings')}
          >
            詳細評価
          </a>
          <a href="#section-seo-body" className="shrink-0 rounded-full bg-white px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50">
            FAQ
          </a>
        </div>
      </nav>

      {/* 口コミ一覧への導線（ページ上部に1回のみ） */}
      <div className="mb-6">
        <SchoolHubReviewsListCta encodedSlug={encodedSlug} />
      </div>

      {/* 実口コミを早い段階で提示し、AI要約・集計の根拠にアクセスしやすくする */}
      <div id="section-featured">{children}</div>

      {/* 口コミサマリー（良い点・改善してほしい点の傾向）— LLM要約3箇条ずつ */}
      <section id="section-review-summary" className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">口コミから見た総評</h2>
        {decisionLeadTruncated && (
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{decisionLeadTruncated}</p>
        )}
        {school.review_tendency ? (
          <>
            {school.review_count < FEW_REVIEWS_THRESHOLD && (
              <p className="text-sm text-amber-700 bg-amber-50/80 rounded-lg px-3 py-2 mb-4">
                現在{school.review_count}件の口コミをもとに要約しています。
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-2">評価されている点</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {school.review_tendency.good_points.map((text, i) => (
                    <li key={i}>・{text}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-rose-700 mb-2">気になる点・注意点</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {school.review_tendency.improvement_points.map((text, i) => (
                    <li key={i}>・{text}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : school.review_count === 0 ? (
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p className="text-gray-600">
              口コミがまだないため、傾向の一覧はありません。学校選びでは次の点を公式情報とあわせて確認すると比較しやすくなります。
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>学費総額・分割納入・就学支援金の対象可否</li>
              <li>通学型・オンライン型、スクーリングや課外の頻度</li>
              <li>担任・サポート、不登校支援の有無と窓口</li>
              <li>単位取得や進路指導のサポート体制</li>
            </ul>
            <p className="text-gray-600">
              {school.prefecture && school.prefecture !== '不明' ? (
                <>
                  ページ下部の「評判の詳細・よくある質問」や、
                  <Link
                    href={appPath(getPrefecturePath(school.prefecture))}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {school.prefecture}の通信制高校一覧
                  </Link>
                  もあわせてご覧ください。
                </>
              ) : (
                <>ページ下部の「評判の詳細・よくある質問」もあわせてご覧ください。</>
              )}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">要約はまだ公開されていません。口コミ一覧をご覧ください。</p>
        )}
        {school.review_count > 0 && (
          <ReviewsListInlineLink
            encodedSlug={encodedSlug}
            label="要約のもとになった口コミを一覧で読む"
          />
        )}
      </section>

      <div className="grid gap-8 mb-8">
        <section id="section-good-reputation" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">良い口コミ・評価されている点</h2>
          {school.review_tendency?.good_points.length ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {school.review_tendency.good_points.map((text, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : goodBadSeo ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{goodBadSeo}</p>
          ) : school.latest_reviews.some((review) => review.good_comment) ? (
            <div className="space-y-3">
              {school.latest_reviews
                .filter((review) => review.good_comment)
                .slice(0, 2)
                .map((review) => (
                  <blockquote key={review.id} className="rounded-lg border-l-4 border-green-500 bg-green-50/50 p-3 text-sm text-gray-700 leading-relaxed">
                    {review.good_comment}
                  </blockquote>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              良い点に関する口コミはまだ十分に集まっていません。学校概要や公式情報もあわせて確認してください。
            </p>
          )}
        </section>

        <section id="section-concerns" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">気になる口コミ・注意点</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            学校名で不安な検索をする場合は、学費、通学頻度、サポート体制、学習ペースが自分に合うかを分けて確認すると判断しやすくなります。
          </p>
          {school.review_tendency?.improvement_points.length ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {school.review_tendency.improvement_points.map((text, i) => (
                <li key={i} className="flex gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : goodBadSeo ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{goodBadSeo}</p>
          ) : school.latest_reviews.some((review) => review.bad_comment) ? (
            <div className="space-y-3">
              {school.latest_reviews
                .filter((review) => review.bad_comment)
                .slice(0, 2)
                .map((review) => (
                  <blockquote key={review.id} className="rounded-lg border-l-4 border-rose-500 bg-rose-50/50 p-3 text-sm text-gray-700 leading-relaxed">
                    {review.bad_comment}
                  </blockquote>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              気になる点に関する口コミはまだ十分に集まっていません。説明会では学費、通学頻度、サポート範囲を具体的に確認しましょう。
            </p>
          )}
        </section>

        <section id="section-tuition" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">学費・費用感</h2>
          {hasDisplayableTuition(school.tuition_estimate ?? null) && (
            <TuitionDisclaimer variant="lead" className="mb-4" />
          )}
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <TuitionEstimateBlock estimate={school.tuition_estimate ?? null} />
            {school.tuition_rating_avg != null ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="font-semibold text-gray-900 mb-1">口コミでの学費の納得感</p>
                <p>
                  平均は{school.tuition_rating_avg.toFixed(1)} / 5.0です。
                  {tuitionComparison ? ` ${tuitionComparison}` : ''}
                </p>
                {school.review_count <= TUITION_SATISFACTION_FEW_REVIEWS_MAX && (
                  <p className="mt-2 text-amber-800">
                    口コミは{school.review_count}件のため、参考情報として確認してください。
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">
                学費の納得感に関する口コミ評価はまだ十分に集まっていません。
              </p>
            )}
            {tuitionSeo && <p className="whitespace-pre-wrap">{tuitionSeo}</p>}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">確認しておきたい費用項目</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2 list-disc pl-5">
                <li>入学金・授業料</li>
                <li>施設・設備費、教材費</li>
                <li>スクーリング費、交通費、宿泊費</li>
                <li>サポート費、オプション講座費</li>
                <li>就学支援金適用後の実質負担</li>
                <li>年度途中入学やコース変更時の費用</li>
              </ul>
            </div>
            {!hasDisplayableTuition(school.tuition_estimate ?? null) && (
              <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-slate-700">
                通信制高校の費用は、年度、コース、通学頻度、キャンパス、就学支援金、世帯年収などで変わります。このページでは実額を断定せず、最新金額は学校公式サイト、資料請求、説明会で確認する前提で掲載しています。
              </p>
            )}
            {school.review_count > 0 && (
              <ReviewsListInlineLink
                encodedSlug={encodedSlug}
                label="在校生・保護者の口コミを一覧で見る"
              />
            )}
          </div>
        </section>

        <section id="section-attendance" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">口コミ回答者の通学頻度・スクーリング</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            以下は学校公式の通学条件ではなく、このサイトに口コミを投稿した在校生・卒業生・保護者の回答分布です。実際の登校日数やスクーリング日程は、コース・キャンパス・年度によって変わるため、最新情報は学校公式の案内で確認してください。
          </p>
          {topAttendance.length > 0 ? (
            <div className="space-y-3 mb-4">
              {topAttendance.map(([label, count]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm text-gray-700 mb-1">
                    <span>{label}</span>
                    <span>回答者の{formatPercentage(count, school.review_count)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${formatPercentage(count, school.review_count)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-4">
              口コミ回答では、通学頻度の回答分布はまだ十分に集まっていません。
            </p>
          )}
          {syllabusSeo ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{syllabusSeo}</p>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              スクーリングや通学頻度は、コースやキャンパスによって変わることがあります。無理なく通えるか、登校日数や会場、オンライン対応の有無を学校公式の資料や説明会で確認しましょう。
            </p>
          )}
        </section>

        <section id="section-learning-style" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">コース・学習スタイル</h2>
          {school.course_listing && school.course_listing.courses.length > 0 && (
            <CourseListBlock
              listing={school.course_listing}
              officialUrl={school.official_url ?? null}
              className="mb-5"
            />
          )}
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            以下は学校公式のコース一覧ではなく、このサイトに口コミを投稿した人の回答分布です。学習スタイルや選んだ理由は、在籍コース・時期・キャンパスによって変わる可能性があります。
          </p>
          {topTeachingStyles.length > 0 || topStudentAtmosphere.length > 0 || topReasons.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3 mb-5">
              <ResponseDistributionCard
                title="授業スタイル"
                total={school.review_count}
                items={topTeachingStyles.map(([label, count]) => ({
                  label: getQuestionLabel('teaching_style', label),
                  count,
                }))}
              />
              <ResponseDistributionCard
                title="生徒の雰囲気"
                total={school.review_count}
                items={topStudentAtmosphere.map(([label, count]) => ({
                  label: getQuestionLabel('student_atmosphere', label),
                  count,
                }))}
              />
              <ResponseDistributionCard
                title="選ばれた理由"
                total={school.review_count}
                items={topReasons.map(([label, count]) => ({ label, count }))}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-4">
              口コミ回答では、学習スタイルに関する回答分布はまだ十分に集まっていません。
            </p>
          )}
          {learningSeo ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{learningSeo}</p>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              レポート中心、オンライン中心、通学型、個別サポート型など、学び方は学校やコースによって異なります。入学前に、自分の生活リズムや学習ペースに合うか確認しましょう。
            </p>
          )}
        </section>

        {(fvSummary.fitsBullets.length > 0 || fvSummary.notFitsBullets.length > 0 || flexibilitySeo) && (
          <section id="section-fit" className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-2">向いている人・向いていない可能性がある人</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              以下は、このサイトに投稿された口コミをもとにAIが傾向を整理したものです。公式な適性診断ではないため、最終的には説明会や資料でサポート内容・通学条件を確認してください。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-green-700">向いている人</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-100">
                    口コミのAI分析
                  </span>
                </div>
                {fvSummary.fitsBullets.length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {fvSummary.fitsBullets.slice(0, 4).map((text, i) => (
                      <li key={i}>・{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-700">口コミ傾向が集まり次第、向いている人の特徴を整理します。</p>
                )}
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-rose-700">注意したい人</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-100">
                    口コミのAI分析
                  </span>
                </div>
                {fvSummary.notFitsBullets.length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {fvSummary.notFitsBullets.slice(0, 4).map((text, i) => (
                      <li key={i}>・{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-700">通学頻度、サポート範囲、学費の確認ポイントを事前に整理しておくと安心です。</p>
                )}
              </div>
            </div>
            {flexibilitySeo && (
              <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{flexibilitySeo}</p>
            )}
          </section>
        )}
      </div>

      {relatedSchools}

      <ThemeHubNav
        heading={`${school.name}を検討中の方がよく見るテーマ`}
        hubIds={['tuition', 'schooling', 'transfer', 'demerit']}
        compact
        className="mb-8"
      />

      <RequestNotificationCta
        source="school_detail"
        schoolName={school.name}
        schoolSlug={school.slug ?? encodedSlug}
        prefecture={school.prefecture ?? undefined}
        className="mb-8"
      />

      {/* グラフブロック（詳細評価・みんなの傾向）— 全タブをDOMに出力してSSR/SEO対応 */}
      <div id="section-graph" className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
        {school.review_count < GRAPH_HIDDEN_THRESHOLD ? (
          <div className="py-8 text-center">
            <p className="text-gray-600 mb-4">
              口コミ集計グラフは{school.review_count}件のため表示していません。
            </p>
            <SurveyCtaLink
              eventName={GA_EVENTS.reviewPostClick}
              eventParams={{ school_slug: school.slug ?? encodedSlug, placement: 'graph_empty' }}
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              口コミを投稿する
            </SurveyCtaLink>
            {school.review_count === 0 && school.prefecture && school.prefecture !== '不明' && (
              <p className="mt-5 text-sm text-gray-600">
                <Link
                  href={appPath(getPrefecturePath(school.prefecture))}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {school.prefecture}の通信制高校を一覧で比較する
                </Link>
              </p>
            )}
          </div>
        ) : (
          <Tabs
            renderAllPanelsInDOM
            activeTab={graphActiveTab}
            onTabChange={(id) => setGraphActiveTab(id as 'ratings' | 'statistics')}
            tabs={[
            {
              id: 'ratings',
              panelId: 'section-ratings',
              label: '詳細評価',
              content: school.overall_avg !== null ? (
                <div className="space-y-6">
                  {school.global_averages && (
                    <details className="bg-blue-50/60 border border-blue-100 rounded-lg p-4">
                      <summary className="text-sm font-semibold text-blue-800 cursor-pointer flex items-center justify-between">
                        図で見る（レーダーチャート）
                        <span className="text-xs font-normal text-blue-600 ml-2">
                          クリックして開く
                        </span>
                      </summary>
                      <div className="mt-4">
                        <SchoolRadarChart
                          metrics={[
                            {
                              label: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）',
                              schoolValue: school.flexibility_rating_avg,
                              globalValue: school.global_averages.flexibility_rating_avg,
                            },
                            {
                              label: '先生・職員の対応',
                              schoolValue: school.staff_rating_avg,
                              globalValue: school.global_averages.staff_rating_avg,
                            },
                            {
                              label: '心や体調の波・不安などに対するサポート',
                              schoolValue: school.support_rating_avg,
                              globalValue: school.global_averages.support_rating_avg,
                            },
                            {
                              label: '在校生の雰囲気',
                              schoolValue: school.atmosphere_fit_rating_avg,
                              globalValue: school.global_averages.atmosphere_fit_rating_avg,
                            },
                            {
                              label: '単位取得のしやすさ',
                              schoolValue: school.credit_rating_avg,
                              globalValue: school.global_averages.credit_rating_avg,
                            },
                            {
                              label: '学校独自の授業・コースの充実度',
                              schoolValue: school.unique_course_rating_avg,
                              globalValue: school.global_averages.unique_course_rating_avg,
                            },
                            {
                              label: '進学・就職など進路サポートの手厚さ',
                              schoolValue: school.career_support_rating_avg,
                              globalValue: school.global_averages.career_support_rating_avg,
                            },
                            {
                              label: '授業以外の学校行事やキャンパスライフ',
                              schoolValue: school.campus_life_rating_avg,
                              globalValue: school.global_averages.campus_life_rating_avg,
                            },
                            {
                              label: '学費の納得感',
                              schoolValue: school.tuition_rating_avg,
                              globalValue: school.global_averages.tuition_rating_avg,
                            },
                          ]}
                        />
                      </div>
                    </details>
                  )}
                  <RatingDisplay
                    staffRating={school.staff_rating_avg}
                    atmosphereFitRating={school.atmosphere_fit_rating_avg}
                    creditRating={school.credit_rating_avg}
                    tuitionRating={school.tuition_rating_avg}
                    flexibilityRating={school.flexibility_rating_avg}
                    supportRating={school.support_rating_avg}
                    uniqueCourseRating={school.unique_course_rating_avg}
                    careerSupportRating={school.career_support_rating_avg}
                    campusLifeRating={school.campus_life_rating_avg}
                    outlierCounts={school.outlier_counts}
                    globalAverages={school.global_averages}
                  />
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">評価データがありません</p>
              ),
            },
            {
              id: 'statistics',
              panelId: 'section-trends',
              label: 'みんな（口コミ回答者）の傾向',
              content: school.statistics && school.review_count > 0 ? (
                <div className="space-y-6">
                  {/* 基本 */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
                    <div className="space-y-4">
                      <StatisticsSection
                        title="投稿者の立場"
                        items={[
                          {
                            label: '本人',
                            count: school.statistics.respondent_role.本人,
                            percentage: Math.round(
                              (school.statistics.respondent_role.本人 / school.review_count) * 100
                            ),
                          },
                          {
                            label: '保護者',
                            count: school.statistics.respondent_role.保護者,
                            percentage: Math.round(
                              (school.statistics.respondent_role.保護者 / school.review_count) *
                                100
                            ),
                          },
                        ]}
                        type="bar"
                        totalCount={school.review_count}
                        maxInitialItems={3}
                      />
                      <StatisticsSection
                        title="現在の状況"
                        items={Object.entries(school.statistics.status).map(([status, count]) => ({
                          label: status,
                          count,
                          percentage: Math.round((count / school.review_count) * 100),
                        }))}
                        type="bar"
                        totalCount={school.review_count}
                        maxInitialItems={3}
                      />
                    </div>
                  </div>

                  {/* 学び方 */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">学び方</h2>
                    <div className="space-y-4">
                      {Object.keys(school.statistics.attendance_frequency).length > 0 && (
                        <StatisticsSection
                          title="主な通学頻度"
                          items={Object.entries(school.statistics.attendance_frequency)
                            .sort(([, a], [, b]) => b - a)
                            .map(([frequency, count]) => ({
                              label: frequency,
                              count,
                              percentage: Math.round((count / school.review_count) * 100),
                            }))}
                          type="bar"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
                      )}
                      {Object.keys(school.statistics.teaching_style).length > 0 && (
                        <StatisticsSection
                          title="授業のスタイル"
                          items={Object.entries(school.statistics.teaching_style)
                            .sort(([, a], [, b]) => b - a)
                            .map(([style, count]) => ({
                              label: getQuestionLabel('teaching_style', style),
                              count,
                              percentage: Math.round((count / school.review_count) * 100),
                            }))}
                          type="badge"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
                      )}
                    </div>
                  </div>

                  {/* 選んだ理由 */}
                  {Object.keys(school.statistics.reason_for_choosing).length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">選んだ理由</h2>
                      <StatisticsSection
                        title="通信制を選んだ理由"
                        items={Object.entries(school.statistics.reason_for_choosing)
                          .sort(([, a], [, b]) => b - a)
                          .map(([reason, count]) => ({
                            label: reason,
                            count,
                            percentage: Math.round((count / school.review_count) * 100),
                          }))}
                        type="badge"
                        totalCount={school.review_count}
                        maxInitialItems={3}
                      />
                    </div>
                  )}

                  {/* 雰囲気 */}
                  {Object.keys(school.statistics.student_atmosphere).length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">雰囲気</h2>
                      <StatisticsSection
                        title="生徒の雰囲気"
                        items={Object.entries(school.statistics.student_atmosphere)
                          .sort(([, a], [, b]) => b - a)
                          .map(([atmosphere, count]) => ({
                            label: getQuestionLabel('student_atmosphere', atmosphere),
                            count,
                            percentage: Math.round((count / school.review_count) * 100),
                          }))}
                        type="badge"
                        totalCount={school.review_count}
                        maxInitialItems={3}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">統計データがありません</p>
              ),
            },
            {
              id: 'reviews',
              label: '最新の口コミ',
              content: school.latest_reviews.length > 0 ? (
                <div className="space-y-4">
                  {school.latest_reviews.map((review) => (
                    <article
                      key={review.id}
                      className="p-6 bg-white border border-gray-200 rounded-xl shadow-md"
                    >
                      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-blue-50 rounded-full">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                        <span className="text-sm text-gray-500">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      <div className="space-y-4 mb-5">
                        {review.good_comment && (
                          <div className="p-3 bg-green-50/50 rounded-lg border-l-4 border-green-500">
                            <p className="text-xs font-semibold text-green-700 mb-2">良い点</p>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                              {review.good_comment}
                            </p>
                          </div>
                        )}
                        {review.bad_comment && (
                          <div className="p-3 bg-rose-50/50 rounded-lg border-l-4 border-rose-500">
                            <p className="text-xs font-semibold text-rose-700 mb-2">
                              改善してほしい点
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                              {review.bad_comment}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                          <span>{review.like_count || 0}</span>
                        </div>
                        <Link
                          href={appPath(`/reviews/${review.id}`)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          この口コミの詳細・回答属性を見る
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">口コミがありません</p>
              ),
            },
          ]}
        />
        )}
        {school.review_count > 0 && (
          <ReviewsListInlineLink
            encodedSlug={encodedSlug}
            label="すべての口コミを一覧で見る・条件で絞り込む"
          />
        )}
      </div>

      <div id="section-reviews" className="mb-8">
        {!school.latest_reviews?.length && (
          <SurveyCtaLink
            eventName={GA_EVENTS.reviewPostClick}
            eventParams={{ school_slug: school.slug ?? encodedSlug, placement: 'no_featured_reviews' }}
            className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm"
          >
            口コミを投稿する
          </SurveyCtaLink>
        )}
      </div>

      {/* 評判の詳細・よくある質問 — アコーディオン＋プレビュー */}
      {(school.seo_sections && Object.keys(school.seo_sections).length > 0) || (school.faq_items && school.faq_items.length > 0) ? (
        <div id="section-seo-body" className="mb-8 space-y-3">
          {SEO_SECTION_KEYS.map(
            (key) =>
              school.seo_sections?.[key] && (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenSeoAccordion((prev) => ({ ...prev, [key]: !prev[key] }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenSeoAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
                    }
                  }}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 mb-1.5">{SEO_SECTION_LABELS[key]}</h3>
                      {!openSeoAccordion[key] ? (
                        <>
                          <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">
                            {school.seo_sections[key].trim() || emptySeoOrFaqHint}
                          </p>
                          <span className="mt-2 inline-block text-sm font-medium text-blue-600">続きを読む</span>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mt-1">
                            {school.seo_sections[key]}
                          </p>
                          <span className="mt-2 inline-block text-sm font-medium text-blue-600">閉じる</span>
                        </>
                      )}
                    </div>
                    <ChevronDown
                      className={`flex-shrink-0 w-5 h-5 text-gray-500 transition-transform duration-200 ${openSeoAccordion[key] ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </div>
                </div>
              )
          )}
          {faqItemsForDisplay.length > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenSeoAccordion((prev) => ({ ...prev, faq: !prev.faq }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenSeoAccordion((prev) => ({ ...prev, faq: !prev.faq }));
                }
              }}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 mb-1.5">
                    よくある質問（FAQ）
                    <span className="ml-2 text-xs font-normal text-gray-500">（{faqItemsForDisplay.length}件）</span>
                  </h3>
                  {!openSeoAccordion.faq ? (
                    <>
                      <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                        {faqItemsForDisplay[0]
                          ? `${faqItemsForDisplay[0].displayQuestion}${faqItemsForDisplay[0].answer ? ` — ${faqItemsForDisplay[0].answer.slice(0, 60)}…` : ''}`
                          : emptySeoOrFaqHint}
                      </p>
                      <span className="mt-2 inline-block text-sm font-medium text-blue-600">続きを読む</span>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 space-y-4">
                        {faqItemsForDisplay.map((item, i) => {
                          const faqKey = `faq-${i}`;
                          const expanded = expandedSeoContent[faqKey];
                          return (
                            <div key={i} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">{item.displayQuestion}</h4>
                              <p className={`text-gray-700 text-sm leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                                {item.answer.trim() || emptySeoOrFaqHint}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSeoContent((prev) => ({ ...prev, [faqKey]: !prev[faqKey] }));
                                }}
                                className="mt-1 text-sm font-medium text-blue-600 hover:underline"
                              >
                                {expanded ? '閉じる' : '詳細を見る'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <span className="mt-3 inline-block text-sm font-medium text-blue-600">閉じる</span>
                    </>
                  )}
                </div>
                <ChevronDown
                  className={`flex-shrink-0 w-5 h-5 text-gray-500 transition-transform duration-200 ${openSeoAccordion.faq ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ページ最下部：口コミ一覧への導線（同上） */}
      <div className="mt-8">
        <SchoolHubReviewsListCta encodedSlug={encodedSlug} />
      </div>
    </>
  );
}
