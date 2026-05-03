import { notFound } from 'next/navigation';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import SchoolCardServer from '@/components/SchoolCardServer';
import { getArticleBySlug } from '@/lib/articles/getArticleBySlug';
import { getArticleSlugs } from '@/lib/articles/getArticleSlugs';
import { appPath } from '@/lib/base-path';
import StructuredData from '@/components/StructuredData';
import SurveyCtaLink from '@/components/SurveyCtaLink';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import type { ArticleSchool } from '@/lib/types/articles';

export const revalidate = 3600;

/** ビルド時に特集記事を静的生成し、初期HTMLに本文を含める */
export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs;
}

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'interview':
      return 'リアル体験談 クチコミ・インタビュー';
    case 'useful_info':
      return '通信制高校お役立ち情報';
    default:
      return category;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const resolved = params instanceof Promise ? await params : params;
  const encodedSlug = resolved.slug;
  const slug = decodeURIComponent(encodedSlug);

  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const appBase = getAppBaseUrl().replace(/\/$/, '');
  const siteOrigin = getSiteUrl().replace(/\/$/, '');
  const canonical = `${appBase}/features/${encodeURIComponent(article.slug)}`;
  const imageUrl = article.featured_image_url
    ? article.featured_image_url.startsWith('http')
      ? article.featured_image_url
      : article.featured_image_url.startsWith('/')
        ? `${siteOrigin}${article.featured_image_url}`
        : article.featured_image_url
    : undefined;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description || article.excerpt || undefined,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: {
      '@type': 'Organization',
      name: '通信制高校リアルレビュー',
      url: appBase,
    },
    publisher: {
      '@type': 'Organization',
      name: '通信制高校リアルレビュー',
      url: appBase,
      logo: {
        '@type': 'ImageObject',
        url: `${appBase}/logo-service.png`,
      },
    },
    ...(imageUrl ? { image: [imageUrl] } : {}),
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <StructuredData data={articleJsonLd} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href={appPath('/features')}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← 特集ページ一覧に戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
              {getCategoryLabel(article.category)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
          {article.published_at && (
            <p className="text-sm text-gray-500 mb-4">{formatDate(article.published_at)}</p>
          )}
          {article.featured_image_url && (
            <div className="mb-6">
              <img
                src={article.featured_image_url}
                alt={article.title}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
          {article.excerpt && (
            <p className="text-lg text-gray-700 mb-4">{article.excerpt}</p>
          )}
        </div>

        {article.content && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <MarkdownRenderer content={article.content} />
          </div>
        )}

        {article.schools && article.schools.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">関連学校</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {article.schools.map((articleSchool: ArticleSchool) => {
                if (!articleSchool.school) return null;
                const school = articleSchool.school;
                return (
                  <div key={articleSchool.id}>
                    <SchoolCardServer
                      id={school.id}
                      name={school.name}
                      prefecture={school.prefecture}
                      slug={school.slug}
                      reviewCount={school.review_count || 0}
                      overallAvg={school.overall_avg || null}
                    />
                    {articleSchool.note && (
                      <p className="mt-2 text-sm text-gray-600">{articleSchool.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">その他の特集ページ</h2>
          <Link
            href={appPath('/features')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            特集ページ一覧を見る →
          </Link>
          <p className="mt-6 text-sm text-gray-600">
            ご自身の体験を共有すると、後から検討する方の参考になります。
          </p>
          <SurveyCtaLink
            eventName="cta_survey"
            eventParams={{ source: 'feature_article_footer', article_slug: article.slug }}
            className="mt-2 inline-block text-rose-600 font-semibold text-sm hover:underline"
          >
            口コミを投稿する →
          </SurveyCtaLink>
        </div>
      </div>
    </div>
  );
}
