import type { Metadata } from 'next';

// メタ情報は簡易版に変更（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // パフォーマンス向上のため、メタ情報は簡易版に変更
  // 詳細なメタ情報はクライアント側で設定可能
  const decodedSlug = decodeURIComponent(params.slug);
  const articleTitle = decodedSlug.replace(/-/g, ' '); // slugからタイトルを推測（簡易版）

  return {
    title: `${articleTitle} | 通信制高校リアルレビュー`,
    description: '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。',
    keywords: [
      '通信制高校',
      '通信制高校 特集',
      '通信制高校 情報',
    ],
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
