import type { Metadata } from 'next';

// メタ情報は page.tsx の generateMetadata で統一的に管理するため、
// layout.tsx では設定しない（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  // page.tsxで詳細なメタ情報（title, description, keywords等）が設定されるため、
  // ここでは空のメタデータを返す
  return {};
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
