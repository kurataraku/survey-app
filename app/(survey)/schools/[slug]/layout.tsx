import type { Metadata } from 'next';

// メタ情報は page.tsx の generateMetadata で統一的に管理するため、
// layout.tsx では設定しない（パフォーマンス向上のため）
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  return {};
}

export default function SchoolDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
