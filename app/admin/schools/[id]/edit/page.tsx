'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolEditor from '@/components/SchoolEditor';
import ReviewManagementList from '@/components/ReviewManagementList';
import { SchoolFormData, School } from '@/lib/types/schools';

interface PrefectureStat {
  prefecture: string;
  count: number;
  percentage: number;
}

export default function EditSchoolPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'reviews'>('basic');
  const [prefectureStats, setPrefectureStats] = useState<PrefectureStat[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [aliases, setAliases] = useState<Array<{ id: string; alias: string; created_at: string }>>([]);
  const [loadingAliases, setLoadingAliases] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [allSchools, setAllSchools] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchSchool();
    fetchPrefectureStats();
    fetchAliases();
    fetchAllSchools();
  }, [id]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}`);
      if (!response.ok) {
        throw new Error('学校の取得に失敗しました');
      }
      const data = await response.json();
      setSchool(data);
    } catch (error) {
      console.error('学校取得エラー:', error);
      alert('学校の取得に失敗しました');
      router.push('/admin/schools');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrefectureStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}/prefecture-stats`);
      if (!response.ok) {
        throw new Error('都道府県統計の取得に失敗しました');
      }
      const data = await response.json();
      setPrefectureStats(data.prefectureStats || []);
      setTotalResponses(data.totalResponses || 0);
    } catch (error) {
      console.error('都道府県統計取得エラー:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchAliases = async () => {
    setLoadingAliases(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}/aliases`);
      if (!response.ok) {
        throw new Error('別名の取得に失敗しました');
      }
      const data = await response.json();
      setAliases(data.aliases || []);
    } catch (error) {
      console.error('別名取得エラー:', error);
    } finally {
      setLoadingAliases(false);
    }
  };

  const fetchAllSchools = async () => {
    try {
      const response = await fetch(`/api/admin/schools?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        setAllSchools((data.schools || []).filter((s: School) => s.id !== id && s.status !== 'merged'));
      }
    } catch (error) {
      console.error('学校一覧取得エラー:', error);
    }
  };

  const handleSubmit = async (data: SchoolFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '学校情報の更新に失敗しました');
      }

      alert('学校情報を更新しました');
      fetchSchool();
    } catch (error) {
      console.error('学校更新エラー:', error);
      alert(error instanceof Error ? error.message : '学校情報の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`状態を「${newStatus}」に変更しますか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/schools/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...school,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '状態の更新に失敗しました');
      }

      alert('状態を更新しました');
      fetchSchool();
    } catch (error) {
      console.error('状態更新エラー:', error);
      alert(error instanceof Error ? error.message : '状態の更新に失敗しました');
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) {
      alert('別名を入力してください');
      return;
    }

    setIsAddingAlias(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias: newAlias.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '別名の追加に失敗しました');
      }

      setNewAlias('');
      fetchAliases();
      alert('別名を追加しました');
    } catch (error) {
      console.error('別名追加エラー:', error);
      alert(error instanceof Error ? error.message : '別名の追加に失敗しました');
    } finally {
      setIsAddingAlias(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm('この別名を削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/schools/${id}/aliases?alias_id=${aliasId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '別名の削除に失敗しました');
      }

      fetchAliases();
      alert('別名を削除しました');
    } catch (error) {
      console.error('別名削除エラー:', error);
      alert(error instanceof Error ? error.message : '別名の削除に失敗しました');
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetId) {
      alert('統合先の学校を選択してください');
      return;
    }

    if (!confirm('この学校を統合先の学校に統合しますか？この操作は取り消せません。')) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_school_id: mergeTargetId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '統合に失敗しました');
      }

      alert('統合が完了しました');
      router.push('/admin/schools');
    } catch (error) {
      console.error('統合エラー:', error);
      alert(error instanceof Error ? error.message : '統合に失敗しました');
    } finally {
      setIsMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!school) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/schools"
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← 学校一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">学校編集</h1>
        </div>

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              基本情報
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reviews'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              口コミ管理
            </button>
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'basic' ? (
            <div className="space-y-6">
              {/* Status変更 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  状態管理
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">現在の状態:</span>
                  {school.status === 'active' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      active（正規）
                    </span>
                  )}
                  {school.status === 'pending' && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      pending（仮登録）
                    </span>
                  )}
                  {school.status === 'merged' && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                      merged（統合済み）
                    </span>
                  )}
                  {school.status !== 'active' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      activeに変更
                    </button>
                  )}
                  {school.status !== 'pending' && school.status !== 'merged' && (
                    <button
                      onClick={() => handleStatusChange('pending')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                    >
                      pendingに変更
                    </button>
                  )}
                </div>
              </div>

              {/* 別名管理 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  別名管理
                </h3>
                {loadingAliases ? (
                  <p className="text-sm text-gray-600">読み込み中...</p>
                ) : (
                  <div className="space-y-3">
                    {aliases.length > 0 ? (
                      <div className="space-y-2">
                        {aliases.map((alias) => (
                          <div
                            key={alias.id}
                            className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                          >
                            <span className="text-sm text-gray-900">{alias.alias}</span>
                            <button
                              onClick={() => handleDeleteAlias(alias.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">別名が登録されていません</p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAlias}
                        onChange={(e) => setNewAlias(e.target.value)}
                        placeholder="新しい別名を入力"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddAlias();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddAlias}
                        disabled={isAddingAlias}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 統合機能 */}
              {school.status !== 'merged' && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="text-lg font-semibold text-red-900 mb-3">
                    学校統合（危険な操作）
                  </h3>
                  <p className="text-sm text-red-700 mb-4">
                    この学校を他の学校に統合します。統合後、この学校のstatusは「merged」に変更され、すべての口コミデータが統合先の学校に移動します。この操作は取り消せません。
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    >
                      <option value="">統合先の学校を選択</option>
                      {allSchools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleMerge}
                      disabled={!mergeTargetId || isMerging}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                    >
                      {isMerging ? '統合中...' : '統合実行'}
                    </button>
                  </div>
                </div>
              )}

              {/* 回答者の都道府県情報 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  回答者の都道府県情報
                </h3>
                {loadingStats ? (
                  <p className="text-sm text-gray-600">読み込み中...</p>
                ) : prefectureStats.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-3">
                      総回答数: {totalResponses}件
                    </p>
                    <div className="space-y-2">
                      {prefectureStats.map((stat) => (
                        <div key={stat.prefecture} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {stat.prefecture}
                              </span>
                              <span className="text-sm text-gray-600">
                                {stat.count}件 ({stat.percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${stat.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    都道府県情報が登録されている回答がありません。
                  </p>
                )}
              </div>

              <SchoolEditor
                initialData={{
                  name: school.name,
                  prefecture: school.prefecture,
                  prefectures: school.prefectures || (school.prefecture ? [school.prefecture] : []),
                  slug: school.slug || '',
                  intro: school.intro || '',
                  highlights: school.highlights || [],
                  faq: school.faq || [],
                  is_public: school.is_public,
                }}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </div>
          ) : (
            <ReviewManagementList schoolId={id} />
          )}
        </div>
      </div>
    </div>
  );
}




