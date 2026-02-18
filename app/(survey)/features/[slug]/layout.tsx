import type { Metadata } from 'next';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { getArticleBySlug } from '@/lib/articles/getArticleBySlug';

const DESCRIPTION_MAX = 160;

function toAbsoluteImageUrl(url: string | null): string | undefined {
  if (!url || !url.trim()) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = getSiteUrl().replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const slug = decodeURIComponent(resolved.slug);
  const appBaseUrl = getAppBaseUrl();
  const pathname = `/features/${resolved.slug}`;
  const canonical = `${appBaseUrl}${pathname}`;

  const article = await getArticleBySlug(slug);

  const title = article?.meta_title ?? article?.title ?? '特集記事';
  const fullTitle = `${title} | 通信制高校リアルレビュー`;
  const rawDesc = (article?.meta_description ?? article?.excerpt ?? '').trim();
  const description = article
    ? (rawDesc ? truncate(rawDesc, DESCRIPTION_MAX) : '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。')
    : '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。';
  const ogImage = article ? toAbsoluteImageUrl(article.featured_image_url ?? null) : undefined;

  return {
    title: fullTitle,
    description,
    keywords: ['通信制高校', '通信制高校 特集', '通信制高校 情報'],
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      type: 'website',
      url: canonical,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description,
    },
  };
}

export default function ArticleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
