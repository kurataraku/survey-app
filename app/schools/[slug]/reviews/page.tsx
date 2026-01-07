'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReviewCard from '@/components/ReviewCard';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ReviewFilters, { ReviewFilters as ReviewFiltersType } from '@/components/ReviewFilters';

interface Review {
  id: string;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  like_count: number;
  created_at: string;
}

export default function SchoolReviewsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  // URLエンコードされたslugをデコード
  const slug = decodeURIComponent(params.slug as string);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalBeforeFilter, setTotalBeforeFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('newest');
  const [schoolName, setSchoolName] = useState('');
  const [filters, setFilters] = useState<ReviewFiltersType>({});

  const limit = 20;

  // URLクエリパラメータからフィルタを読み込む
  useEffect(() => {
    const role = searchParams.get('role') || undefined;
    const graduationPath = searchParams.get('graduation_path') || undefined;
    const enrollmentType = searchParams.get('enrollment_type') || undefined;
    const attendanceFrequency = searchParams.get('attendance_frequency') || undefined;
    const campusPrefecture = searchParams.get('campus_prefecture') || undefined;
    const reasonForChoosing = searchParams.get('reason_for_choosing');
    const reasonForChoosingArray = reasonForChoosing
      ? reasonForChoosing.split(',').filter((r) => r.trim() !== '')
      : undefined;

    setFilters({
      role,
      graduation_path: graduationPath,
      enrollment_type: enrollmentType,
      attendance_frequency: attendanceFrequency,
      campus_prefecture: campusPrefecture,
      reason_for_choosing: reasonForChoosingArray,
    });

    const pageParam = searchParams.get('page');
    if (pageParam) {
      setPage(parseInt(pageParam, 10));
    }

    const sortParam = searchParams.get('sort');
    if (sortParam) {
      setSort(sortParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchReviews();
  }, [slug, page, sort, filters]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // slugをエンコードして送信
      const encodedSlug = encodeURIComponent(slug);
      const params = new URLSearchParams({
        school_slug: encodedSlug,
        sort: sort,
        page: page.toString(),
        limit: limit.toString(),
      });

      // フィルタパラメータを追加
      if (filters.role) {
        params.append('role', filters.role);
      }
      if (filters.graduation_path) {
        params.append('graduation_path', filters.graduation_path);
      }
      if (filters.enrollment_type) {
        params.append('enrollment_type', filters.enrollment_type);
      }
      if (filters.attendance_frequency) {
        params.append('attendance_frequency', filters.attendance_frequency);
      }
      if (filters.campus_prefecture) {
        params.append('campus_prefecture', filters.campus_prefecture);
      }
      if (filters.reason_for_choosing && filters.reason_for_choosing.length > 0) {
        params.append('reason_for_choosing', filters.reason_for_choosing.join(','));
      }

      const response = await fetch(`/api/reviews?${params.toString()}`);
      if (!response.ok) {
        throw new Error('口コミ取得に失敗しました');
      }

      const data = await response.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setTotalBeforeFilter(data.total_before_filter || data.total);
      setTotalPages(data.total_pages);
      if (data.reviews.length > 0) {
        setSchoolName(data.reviews[0].school_name);
      }
    } catch (error) {
      console.error('口コミ取得エラー:', error);
      alert('口コミの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: ReviewFiltersType) => {
    setFilters(newFilters);
    setPage(1); // フィルタ変更時は1ページ目に戻す

    // URLクエリパラメータを更新
    const params = new URLSearchParams();
    params.set('sort', sort);

    if (newFilters.role) {
      params.set('role', newFilters.role);
    }
    if (newFilters.graduation_path) {
      params.set('graduation_path', newFilters.graduation_path);
    }
    if (newFilters.enrollment_type) {
      params.set('enrollment_type', newFilters.enrollment_type);
    }
    if (newFilters.attendance_frequency) {
      params.set('attendance_frequency', newFilters.attendance_frequency);
    }
    if (newFilters.campus_prefecture) {
      params.set('campus_prefecture', newFilters.campus_prefecture);
    }
    if (newFilters.reason_for_choosing && newFilters.reason_for_choosing.length > 0) {
      params.set('reason_for_choosing', newFilters.reason_for_choosing.join(','));
    }

    router.push(`/schools/${encodeURIComponent(slug)}/reviews?${params.toString()}`, { scroll: false });
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setPage(1);

    // URLクエリパラメータを更新
    const params = new URLSearchParams();
    params.set('sort', value);

    // フィルタパラメータも保持
    if (filters.role) {
      params.set('role', filters.role);
    }
    if (filters.graduation_path) {
      params.set('graduation_path', filters.graduation_path);
    }
    if (filters.enrollment_type) {
      params.set('enrollment_type', filters.enrollment_type);
    }
    if (filters.attendance_frequency) {
      params.set('attendance_frequency', filters.attendance_frequency);
    }
    if (filters.campus_prefecture) {
      params.set('campus_prefecture', filters.campus_prefecture);
    }
    if (filters.reason_for_choosing && filters.reason_for_choosing.length > 0) {
      params.set('reason_for_choosing', filters.reason_for_choosing.join(','));
    }

    router.push(`/schools/${encodeURIComponent(slug)}/reviews?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-3">
          <Link
            href={`/schools/${slug}`}
            className="text-xs text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            学校詳細に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {schoolName || '口コミ一覧'}
          </h1>
          {total > 0 && (
            <p className="text-sm text-gray-600">{total}件の口コミ</p>
          )}
        </div>

        {/* フィルタ（ソート統合） */}
        <ReviewFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          totalCount={totalBeforeFilter}
          filteredCount={total}
          sort={sort}
          onSortChange={handleSortChange}
        />

        {/* 区切り線 */}
        <div className="border-t border-gray-200 my-3"></div>

        {/* 口コミ一覧見出し */}
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">口コミ</h2>
        </div>

        {/* 口コミ一覧 */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <Skeleton height={20} width="60%" className="mb-3" />
                <Skeleton height={16} width="40%" className="mb-4" />
                <Skeleton height={16} width="80%" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            title="口コミが見つかりませんでした"
            description="この学校にはまだ口コミが投稿されていません。"
          />
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  id={review.id}
                  schoolName={review.school_name}
                  schoolSlug={review.school_slug}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  badComment={review.bad_comment}
                  enrollmentYear={review.enrollment_year}
                  attendanceFrequency={review.attendance_frequency}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                />
              ))}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                const newPage = page - 1;
                setPage(newPage);
                // URL更新
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', newPage.toString());
                router.push(`/schools/${encodeURIComponent(slug)}/reviews?${params.toString()}`, { scroll: false });
              }}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              前へ
            </button>
            <span className="px-4 py-2 text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => {
                const newPage = page + 1;
                setPage(newPage);
                // URL更新
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', newPage.toString());
                router.push(`/schools/${encodeURIComponent(slug)}/reviews?${params.toString()}`, { scroll: false });
              }}
              disabled={page >= totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              次へ
            </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

