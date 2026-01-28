import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

// メタ情報は簡易版に変更（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const decodedSlug = decodeURIComponent(resolved.slug);
  const articleTitle = decodedSlug.replace(/-/g, ' '); // slugからタイトルを推測（簡易版）
  const appBaseUrl = getAppBaseUrl();
  const pathname = `/features/${resolved.slug}`;
  const canonical = `${appBaseUrl}${pathname}`;

  return {
    title: `${articleTitle} | 通信制高校リアルレビュー`,
    description: '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。',
    keywords: [
      '通信制高校',
      '通信制高校 特集',
      '通信制高校 情報',
    ],
    alternates: { canonical },
    openGraph: {
      title: `${articleTitle} | 通信制高校リアルレビュー`,
      description: '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。',
      type: 'website',
      url: canonical,
    },
  };
}

export default function ArticleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 構造化データはクライアント側で生成するため、ここでは削除
  // パフォーマンス向上のため、サーバー側での追加クエリを避ける
  return <>{children}</>;
}
