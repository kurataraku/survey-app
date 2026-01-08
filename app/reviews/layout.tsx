import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '通信制高校 口コミ一覧 | 最新のリアルな声',
  description: '通信制高校の最新口コミ・レビュー一覧。実際に通った生徒・保護者のリアルな体験談で、学校選びの参考に。',
  keywords: ['通信制高校 口コミ', '通信制 口コミ', '通信制高校 レビュー', '通信制高校 体験談'],
};

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
