import Link from 'next/link';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { appPath } from '@/lib/base-path';
import {
  THEME_HUBS,
  getAllThemeHubSlugs,
  getThemeHubArticlePath,
  type ThemeHub,
} from '@/lib/theme-hubs';
import { getArticleTitlesBySlugs } from '@/lib/articles/getArticleTitlesBySlugs';
import StructuredData from '@/components/StructuredData';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '通信制高校の選び方ガイド｜学費・公立・スクーリング・転入',
  description:
    '学費、公立、スクーリング、転入・編入など、気になるテーマから記事を選べます。口コミや学校比較とあわせて、通信制高校選びの参考にしてください。',
  alternates: { canonical: `${getAppBaseUrl()}/features/topics` },
  openGraph: {
    title: '通信制高校の選び方ガイド',
    description:
      '学費・公立・スクーリング・転入など、テーマ別に通信制高校の情報を調べられるガイドページです。',
    type: 'website',
    url: `${getAppBaseUrl()}/features/topics`,
  },
};

function buildItemListJsonLd(hubs: ThemeHub[], articleTitles: Map<string, { title: string }>) {
  const appBase = getAppBaseUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '通信制高校の選び方ガイド',
    description: '学費・公立・スクーリングなどテーマ別の記事ガイド',
    itemListElement: hubs.map((hub, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: hub.title,
      url: `${appBase}${getThemeHubArticlePath(hub.primarySlug)}`,
      description: articleTitles.get(hub.primarySlug)?.title,
    })),
  };
}

function getArticleLabel(
  slug: string,
  articleTitles: Map<string, { title: string; excerpt: string | null }>
): string {
  return articleTitles.get(slug)?.title ?? slug;
}

export default async function ThemeHubsPage() {
  const articleTitles = await getArticleTitlesBySlugs(getAllThemeHubSlugs());
  const itemListJsonLd = buildItemListJsonLd(THEME_HUBS, articleTitles);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <StructuredData data={itemListJsonLd} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-gray-500 mb-6" aria-label="パンくず">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={appPath('/')} className="hover:text-blue-600">
                トップ
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={appPath('/features')} className="hover:text-blue-600">
                特集ページ
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-gray-800 font-medium">選び方ガイド</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            通信制高校の選び方ガイド
          </h1>
          <p className="text-gray-600 leading-relaxed max-w-3xl mb-4">
            学校名が決まっていなくても大丈夫です。学費・公立・スクーリング・転入など、
            いま気になっているテーマから記事を選び、口コミや学校比較につなげられます。
          </p>
          <p className="text-sm text-gray-500">
            記事の新着一覧は
            <Link href={appPath('/features')} className="mx-1 text-blue-600 hover:underline">
              特集ページ
            </Link>
            からご覧ください。
          </p>
        </header>

        <nav
          className="mb-8 rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:p-5"
          aria-label="テーマ一覧（ページ内リンク）"
        >
          <p className="text-sm font-semibold text-gray-900 mb-3">気になるテーマから選ぶ</p>
          <ul className="flex flex-wrap gap-2">
            {THEME_HUBS.map((hub) => (
              <li key={hub.id}>
                <a
                  href={`#hub-${hub.id}`}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3.5 py-1.5 text-sm font-medium text-blue-800 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {hub.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {THEME_HUBS.map((hub) => {
            const primary = articleTitles.get(hub.primarySlug);
            const related = (hub.relatedSlugs ?? [])
              .map((slug) => ({ slug, ...articleTitles.get(slug) }))
              .filter((entry) => entry.title);

            return (
              <section
                key={hub.id}
                id={`hub-${hub.id}`}
                className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm"
                aria-labelledby={`hub-${hub.id}-heading`}
              >
                <h2 id={`hub-${hub.id}-heading`} className="text-xl font-bold text-gray-900 mb-2">
                  {hub.title}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{hub.description}</p>

                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 md:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
                    まず読む記事
                  </p>
                  <Link
                    href={getThemeHubArticlePath(hub.primarySlug)}
                    className="text-base md:text-lg font-bold text-blue-800 hover:text-blue-900 hover:underline leading-snug"
                  >
                    {primary?.title ?? getArticleLabel(hub.primarySlug, articleTitles)}
                  </Link>
                  {primary?.excerpt && (
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {primary.excerpt}
                    </p>
                  )}
                  <Link
                    href={getThemeHubArticlePath(hub.primarySlug)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    記事を読む
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {related.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-gray-800 mb-3">あわせて読みたい</p>
                    <ul className="space-y-2">
                      {related.map(({ slug, title, excerpt }) => (
                        <li key={slug}>
                          <Link
                            href={getThemeHubArticlePath(slug)}
                            className="group block rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3 hover:border-blue-200 hover:bg-blue-50/50 transition-colors"
                          >
                            <span className="block text-sm font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline">
                              {title}
                            </span>
                            {excerpt && (
                              <span className="mt-1 block text-xs text-gray-500 leading-relaxed line-clamp-1">
                                {excerpt}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <section
          className="mt-10 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
          aria-labelledby="next-steps-heading"
        >
          <h2 id="next-steps-heading" className="text-lg font-bold text-gray-900 mb-2">
            記事を読んだあとは
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            気になる学校が見えてきたら、口コミや評価を比較してみてください。
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            <li>
              <Link
                href={appPath('/schools')}
                className="flex h-full flex-col rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
              >
                <span className="text-sm font-bold text-gray-900 mb-1">学校を比較する</span>
                <span className="text-xs text-gray-600">口コミ件数や満足度から探せます</span>
              </Link>
            </li>
            <li>
              <Link
                href={appPath('/simulator')}
                className="flex h-full flex-col rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
              >
                <span className="text-sm font-bold text-gray-900 mb-1">診断ナビで絞り込む</span>
                <span className="text-xs text-gray-600">約5分・無料で学校タイプを診断</span>
              </Link>
            </li>
            <li>
              <Link
                href={appPath('/features')}
                className="flex h-full flex-col rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
              >
                <span className="text-sm font-bold text-gray-900 mb-1">特集記事一覧</span>
                <span className="text-xs text-gray-600">インタビューや体験談も読めます</span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
