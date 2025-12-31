'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RankingCard from '@/components/RankingCard';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  review_count: number;
  overall_avg: number | null;
  staff_avg: number | null;
  atmosphere_avg: number | null;
  credit_avg: number | null;
  tuition_avg: number | null;
}

interface RankingsData {
  schools: School[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  type: string;
}

// 注意: 進学実績ランキングは削除されました。追加しないでください。
const rankingConfig: Record<string, { title: string; valueKey: keyof School; valueLabel: string; valueType: 'rating' | 'count' | 'percentage' }> = {
  overall: {
    title: '総合評判ランキング',
    valueKey: 'overall_avg',
    valueLabel: '総合満足度',
    valueType: 'rating',
  },
  staff: {
    title: '先生対応ランキング',
    valueKey: 'staff_avg',
    valueLabel: '先生対応評価',
    valueType: 'rating',
  },
  atmosphere: {
    title: '雰囲気ランキング',
    valueKey: 'atmosphere_avg',
    valueLabel: '雰囲気評価',
    valueType: 'rating',
  },
  credit: {
    title: '単位取得ランキング',
    valueKey: 'credit_avg',
    valueLabel: '単位取得評価',
    valueType: 'rating',
  },
  tuition: {
    title: '学費満足度ランキング',
    valueKey: 'tuition_avg',
    valueLabel: '学費満足度',
    valueType: 'rating',
  },
  'review-count': {
    title: '口コミ数ランキング',
    valueKey: 'review_count',
    valueLabel: '口コミ数',
    valueType: 'count',
  },
};

function RankingsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = params.type as string;
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const page = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    fetchRankings();
  }, [type, page]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/rankings/[type]/page.tsx:83',message:'ランキング取得開始',data:{type,page},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/rankings/${type}?page=${page}&limit=20`);
      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/rankings/[type]/page.tsx:86',message:'ランキング取得失敗',data:{type,page,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        throw new Error('ランキングの取得に失敗しました');
      }
      const rankingsData = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/rankings/[type]/page.tsx:90',message:'ランキング取得成功',data:{type,page,schoolsCount:rankingsData.schools?.length||0,total:rankingsData.total},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setData(rankingsData);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/rankings/[type]/page.tsx:92',message:'ランキング取得エラー',data:{type,page,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('ランキング取得エラー:', error);
      alert('ランキングの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const config = rankingConfig[type];

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">無効なランキングタイプです</p>
            <Link href="/rankings" className="mt-4 text-orange-600 hover:text-orange-700">
              ランキング一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.schools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">ランキングデータがありません</p>
            <Link href="/rankings" className="mt-4 text-orange-600 hover:text-orange-700">
              ランキング一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const startRank = (page - 1) * 20 + 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/rankings"
            className="text-orange-600 hover:text-orange-700 mb-4 inline-block"
          >
            ← ランキング一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {config.title}
          </h1>
          <p className="text-gray-600">
            {data.total}校中 {startRank}位〜{Math.min(startRank + data.schools.length - 1, data.total)}位を表示
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {data.schools.map((school, index) => (
            <RankingCard
              key={school.id}
              rank={startRank + index}
              id={school.id}
              name={school.name}
              prefecture={school.prefecture}
              slug={school.slug}
              reviewCount={school.review_count}
              value={school[config.valueKey] as number | null}
              valueLabel={config.valueLabel}
              valueType={config.valueType}
            />
          ))}
        </div>

        {/* ページネーション */}
        {data.total_pages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => router.push(`/rankings/${type}?page=${page - 1}`)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              前へ
            </button>
            <span className="px-4 py-2 text-gray-600">
              {page} / {data.total_pages}
            </span>
            <button
              onClick={() => router.push(`/rankings/${type}?page=${page + 1}`)}
              disabled={page >= data.total_pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankingsTypePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">読み込み中...</p>
            </div>
          </div>
        </div>
      }
    >
      <RankingsContent />
    </Suspense>
  );
}

