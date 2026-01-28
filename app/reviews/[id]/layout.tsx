import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

// メタ情報は簡易版に変更（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const appBaseUrl = getAppBaseUrl();
  const pathname = `/reviews/${resolved.id}`;
  const canonical = `${appBaseUrl}${pathname}`;

  return {
    title: '口コミ詳細 | 通信制高校リアルレビュー',
    description: '通信制高校の口コミ・レビュー詳細を確認。実際に通った人のリアルな体験談。',
    keywords: [
      '通信制高校 口コミ',
      '通信制 口コミ',
      '通信制高校 体験談',
    ],
    alternates: { canonical },
    openGraph: {
      title: '口コミ詳細 | 通信制高校リアルレビュー',
      description: '通信制高校の口コミ・レビュー詳細を確認。実際に通った人のリアルな体験談。',
      type: 'website',
      url: canonical,
    },
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
