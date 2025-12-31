'use client';

import Link from 'next/link';

// 注意: 進学実績ランキングは削除されました。追加しないでください。
const rankingTypes = [
  {
    id: 'overall',
    title: '総合評判ランキング',
    description: '総合満足度の高い学校ランキング',
    icon: '⭐',
  },
  {
    id: 'review-count',
    title: '口コミ数ランキング',
    description: '口コミ数が多い学校ランキング',
    icon: '💬',
  },
  {
    id: 'staff',
    title: '先生対応ランキング',
    description: '先生・職員の対応評価が高い学校',
    icon: '👨‍🏫',
  },
  {
    id: 'atmosphere',
    title: '雰囲気ランキング',
    description: '在校生の雰囲気評価が高い学校',
    icon: '😊',
  },
  {
    id: 'credit',
    title: '単位取得ランキング',
    description: '単位取得のしやすさ評価が高い学校',
    icon: '📚',
  },
  {
    id: 'tuition',
    title: '学費満足度ランキング',
    description: '学費の納得感評価が高い学校',
    icon: '💰',
  },
];

export default function RankingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            ランキング
          </h1>
          <p className="text-gray-600">
            様々な指標で通信制高校をランキング形式で確認できます。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rankingTypes.map((ranking) => (
            <Link
              key={ranking.id}
              href={`/rankings/${ranking.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-orange-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{ranking.icon}</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {ranking.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {ranking.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-orange-600 font-medium">
                  詳細を見る →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

