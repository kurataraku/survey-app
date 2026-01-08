import type { Metadata } from 'next';

// メタ情報は簡易版に変更（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // パフォーマンス向上のため、メタ情報は簡易版に変更
  // 詳細なメタ情報はクライアント側で設定可能
  return {
    title: '口コミ詳細 | 通信制高校リアルレビュー',
    description: '通信制高校の口コミ・レビュー詳細を確認。実際に通った人のリアルな体験談。',
    keywords: [
      '通信制高校 口コミ',
      '通信制 口コミ',
      '通信制高校 体験談',
    ],
  };
}

export default function ReviewDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 構造化データはクライアント側で生成するため、ここでは削除
  // パフォーマンス向上のため、サーバー側での追加クエリを避ける
  return <>{children}</>;
}
