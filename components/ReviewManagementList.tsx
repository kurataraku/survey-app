'use client';

import { useState, useEffect } from 'react';
import { Review } from '@/lib/types/reviews';
import { prefectures } from '@/lib/prefectures';

interface ReviewManagementListProps {
  schoolId: string;
}

interface ReviewWithAnswers extends Review {
  answers?: any;
}

export default function ReviewManagementList({ schoolId }: ReviewManagementListProps) {
  const [reviews, setReviews] = useState<ReviewWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewWithAnswers | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  const limit = 20;

  useEffect(() => {
    fetchReviews();
  }, [schoolId, page]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      // is_publicフィルタリングは削除（テーブルにis_publicカラムが存在しない可能性があるため）

      const response = await fetch(`/api/admin/schools/${schoolId}/reviews?${params.toString()}`);
      if (!response.ok) {
        throw new Error('口コミ一覧の取得に失敗しました');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('口コミ一覧取得エラー:', error);
      alert('口コミ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async (reviewId: string, currentIsPublic: boolean) => {
    setUpdatingId(reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_public: !currentIsPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('口コミの更新に失敗しました');
      }

      // リストを更新
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId ? { ...review, is_public: !currentIsPublic } : review
        )
      );
    } catch (error) {
      console.error('口コミ更新エラー:', error);
      alert('口コミの更新に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditClick = (review: ReviewWithAnswers) => {
    setEditingReview(review);
    // answersを編集用のフォームデータに変換
    const answers = review.answers || {};
    // campus_prefectureを配列として扱う（既存データが文字列の場合も配列に変換）
    const campusPrefecture = answers.campus_prefecture;
    const campusPrefectureArray = Array.isArray(campusPrefecture)
      ? campusPrefecture
      : campusPrefecture && String(campusPrefecture).trim() !== ''
      ? [String(campusPrefecture).trim()]
      : [];
    
    setEditFormData({
      reason_for_choosing: Array.isArray(answers.reason_for_choosing) ? answers.reason_for_choosing : [],
      attendance_frequency: answers.attendance_frequency || '',
      campus_prefecture: campusPrefectureArray,
    });
  };

  const handleEditSubmit = async () => {
    if (!editingReview) return;

    setUpdatingId(editingReview.id);
    try {
      const response = await fetch(`/api/admin/reviews/${editingReview.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: {
            reason_for_choosing: editFormData.reason_for_choosing,
            attendance_frequency: editFormData.attendance_frequency,
            campus_prefecture: editFormData.campus_prefecture,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('口コミの更新に失敗しました');
      }

      // リストを更新
      await fetchReviews();
      setEditingReview(null);
      setEditFormData(null);
      alert('口コミを更新しました');
    } catch (error) {
      console.error('口コミ更新エラー:', error);
      alert('口コミの更新に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('この口コミを削除してもよろしいですか？\nこの操作は取り消せません。')) {
      return;
    }

    setUpdatingId(reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('口コミの削除に失敗しました');
      }

      // リストを更新
      await fetchReviews();
      alert('口コミを削除しました');
    } catch (error) {
      console.error('口コミ削除エラー:', error);
      alert('口コミの削除に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">口コミ管理</h3>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500 text-center py-8">口コミがありません</p>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {review.respondent_role}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {review.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold text-gray-900">
                        {review.overall_satisfaction} / 5
                      </span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.overall_satisfaction
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300 fill-gray-300'
                            }`}
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>
                        <span className="font-medium">良かった点：</span>
                        {review.good_comment}
                      </div>
                      <div>
                        <span className="font-medium">改善点：</span>
                        {review.bad_comment}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditClick(review)}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      disabled={updatingId === review.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      {updatingId === review.id ? '削除中...' : '削除'}
                    </button>
                    {review.is_public !== undefined && (
                      <button
                        type="button"
                        onClick={() => handleTogglePublic(review.id, review.is_public || false)}
                        disabled={updatingId === review.id}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          review.is_public
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {updatingId === review.id
                          ? '更新中...'
                          : review.is_public
                          ? '採用中'
                          : '不採用'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                前へ
              </button>
              <span className="px-4 py-2 text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* 編集モーダル */}
      {editingReview && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">口コミ編集</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  通信制を選んだ理由
                </label>
                <input
                  type="text"
                  value={Array.isArray(editFormData.reason_for_choosing) 
                    ? editFormData.reason_for_choosing.join(', ') 
                    : editFormData.reason_for_choosing || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      reason_for_choosing: value ? value.split(',').map(s => s.trim()) : [],
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="カンマ区切りで入力（例: 心の不調のため, 人間関係）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  通学頻度
                </label>
                <select
                  value={editFormData.attendance_frequency || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      attendance_frequency: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  <option value="週5">週5</option>
                  <option value="週3〜4">週3〜4</option>
                  <option value="週1〜2">週1〜2</option>
                  <option value="月1〜数回">月1〜数回</option>
                  <option value="ほぼオンライン/自宅">ほぼオンライン/自宅</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  都道府県（複数選択可）
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {prefectures.map((pref) => {
                    const isSelected = editFormData.campus_prefecture?.includes(pref) || false;
                    return (
                      <label key={pref} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentPrefectures = editFormData.campus_prefecture || [];
                            if (e.target.checked) {
                              setEditFormData({
                                ...editFormData,
                                campus_prefecture: [...currentPrefectures, pref],
                              });
                            } else {
                              setEditFormData({
                                ...editFormData,
                                campus_prefecture: currentPrefectures.filter((p) => p !== pref),
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{pref}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  選択された都道府県: {editFormData.campus_prefecture?.length || 0}件
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setEditingReview(null);
                  setEditFormData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={updatingId === editingReview.id}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updatingId === editingReview.id ? '更新中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




