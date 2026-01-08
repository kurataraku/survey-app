import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '通信制高校 ランキング | 総合評判・口コミ数・評価別',
  description: '通信制高校を様々な指標でランキング形式で比較。総合評判、口コミ数、先生対応、雰囲気、単位取得、学費満足度などで人気の学校をチェック。',
  keywords: ['通信制高校 ランキング', '通信制高校 人気', '通信制高校 評判', '通信制高校 比較'],
};

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
