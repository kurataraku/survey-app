import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '特集記事 | 通信制高校リアルレビュー',
  description: '通信制高校に関する特集記事・インタビュー・お役立ち情報を掲載。実際に通った人の体験談や、学校選びに役立つ情報を提供。',
  keywords: ['通信制高校', '通信制高校 特集', '通信制高校 情報', '通信制高校 体験談', '通信制高校 インタビュー'],
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
