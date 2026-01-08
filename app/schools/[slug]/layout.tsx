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
  const schoolName = decodedSlug.replace(/-/g, ' '); // slugから学校名を推測（簡易版）

  return {
    title: `${schoolName} 口コミ・評判 | 通信制高校リアルレビュー`,
    description: `${schoolName}の口コミ・評判を確認。実際に通った人のリアルな声で、学校選びの参考に。`,
    keywords: [
      `${schoolName} 口コミ`,
      `${schoolName} 評判`,
      '通信制高校 口コミ',
      '通信制 口コミ',
    ],
  };
}

export default function SchoolDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 構造化データはクライアント側で生成するため、ここでは削除
  // パフォーマンス向上のため、サーバー側での追加クエリを避ける
  return <>{children}</>;
}
