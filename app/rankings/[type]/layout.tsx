import type { Metadata } from 'next';

const rankingTypeLabels: Record<string, { title: string; description: string }> = {
  overall: {
    title: '総合評判ランキング',
    description: '総合満足度の高い通信制高校ランキング。実際に通った人の評価で選ばれた人気の学校をチェック。',
  },
  'review-count': {
    title: '口コミ数ランキング',
    description: '口コミ数が多い通信制高校ランキング。多くの体験談が集まる学校を確認。',
  },
  staff: {
    title: '先生対応ランキング',
    description: '先生・職員の対応評価が高い通信制高校ランキング。サポートが充実している学校をチェック。',
  },
  atmosphere: {
    title: '雰囲気ランキング',
    description: '在校生の雰囲気評価が高い通信制高校ランキング。自分に合う環境を見つけよう。',
  },
  credit: {
    title: '単位取得ランキング',
    description: '単位取得のしやすさ評価が高い通信制高校ランキング。学習の進めやすさで比較。',
  },
  tuition: {
    title: '学費満足度ランキング',
    description: '学費の納得感評価が高い通信制高校ランキング。費用対効果で学校を比較。',
  },
};

export async function generateMetadata({
  params,
}: {
  params: { type: string };
}): Promise<Metadata> {
  const rankingInfo = rankingTypeLabels[params.type] || {
    title: 'ランキング',
    description: '通信制高校を様々な指標でランキング形式で比較。',
  };

  return {
    title: `通信制高校 ${rankingInfo.title} | 通信制高校リアルレビュー`,
    description: rankingInfo.description,
    keywords: [
      '通信制高校 ランキング',
      `通信制高校 ${rankingInfo.title}`,
      '通信制高校 人気',
      '通信制高校 比較',
    ],
  };
}

export default function RankingTypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
