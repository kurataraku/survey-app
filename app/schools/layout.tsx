import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '通信制高校一覧 | 口コミ・評判で選ぶ',
  description: '通信制高校を口コミ・評判で検索・比較。実際に通った人のリアルな声で、あなたに合う通信制高校を見つけよう。都道府県別、評価別で絞り込み検索可能。',
  keywords: ['通信制高校', '通信制高校 一覧', '通信制高校 検索', '通信制高校 口コミ', '通信制高校 評判'],
};

export default function SchoolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
