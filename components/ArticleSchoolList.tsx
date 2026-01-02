'use client';

import { useState, useEffect } from 'react';
import { ArticleSchool } from '@/lib/types/articles';

interface ArticleSchoolListProps {
  articleId: string;
}

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
}

export default function ArticleSchoolList({ articleId }: ArticleSchoolListProps) {
  const [schools, setSchools] = useState<ArticleSchool[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [note, setNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchSchools();
    fetchAllSchools();
  }, [articleId]);

  const fetchSchools = async () => {
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`);
      if (!response.ok) {
        throw new Error('記事の取得に失敗しました');
      }
      const data = await response.json();
      // SupabaseのJOINクエリは`schools`（複数形）を返すので、データ構造を変換
      const schoolsWithCorrectStructure = (data.schools || []).map((as: any) => ({
        ...as,
        school: as.schools || as.school, // `schools`があれば`school`に変換
      }));
      setSchools(schoolsWithCorrectStructure);
    } catch (error) {
      console.error('関連学校取得エラー:', error);
      alert('関連学校の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSchools = async () => {
    try {
      const response = await fetch('/api/admin/schools?limit=1000');
      if (!response.ok) {
        throw new Error('学校一覧の取得に失敗しました');
      }
      const data = await response.json();
      setAllSchools(data.schools || []);
    } catch (error) {
      console.error('学校一覧取得エラー:', error);
    }
  };

  const handleAddSchool = async () => {
    if (!selectedSchoolId) {
      alert('学校を選択してください');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/schools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          school_id: selectedSchoolId,
          display_order: displayOrder,
          note: note || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '学校の追加に失敗しました');
      }

      alert('学校を追加しました');
      setSelectedSchoolId('');
      setDisplayOrder(0);
      setNote('');
      fetchSchools();
    } catch (error) {
      console.error('学校追加エラー:', error);
      alert(error instanceof Error ? error.message : '学校の追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateSchool = async (schoolId: string, newDisplayOrder: number, newNote: string) => {
    try {
      const response = await fetch(`/api/admin/articles/${articleId}/schools/${schoolId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_order: newDisplayOrder,
          note: newNote || null,
        }),
      });

      if (!response.ok) {
        throw new Error('学校情報の更新に失敗しました');
      }

      fetchSchools();
    } catch (error) {
      console.error('学校更新エラー:', error);
      alert('学校情報の更新に失敗しました');
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`「${schoolName}」を関連学校から削除してもよろしいですか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/articles/${articleId}/schools/${schoolId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('学校の削除に失敗しました');
      }

      alert('学校を削除しました');
      fetchSchools();
    } catch (error) {
      console.error('学校削除エラー:', error);
      alert('学校の削除に失敗しました');
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSchools = [...schools];
    const temp = newSchools[index].display_order;
    newSchools[index].display_order = newSchools[index - 1].display_order;
    newSchools[index - 1].display_order = temp;
    setSchools(newSchools);
    handleUpdateSchool(newSchools[index].school_id, newSchools[index].display_order, newSchools[index].note || '');
    handleUpdateSchool(newSchools[index - 1].school_id, newSchools[index - 1].display_order, newSchools[index - 1].note || '');
  };

  const handleMoveDown = (index: number) => {
    if (index === schools.length - 1) return;
    const newSchools = [...schools];
    const temp = newSchools[index].display_order;
    newSchools[index].display_order = newSchools[index + 1].display_order;
    newSchools[index + 1].display_order = temp;
    setSchools(newSchools);
    handleUpdateSchool(newSchools[index].school_id, newSchools[index].display_order, newSchools[index].note || '');
    handleUpdateSchool(newSchools[index + 1].school_id, newSchools[index + 1].display_order, newSchools[index + 1].note || '');
  };

  const filteredSchools = allSchools.filter(
    (school) =>
      !schools.some((as) => as.school_id === school.id) &&
      (school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        school.prefecture.includes(searchQuery))
  );

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">関連学校の追加</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学校を検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="学校名または都道府県で検索"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {searchQuery && filteredSchools.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
              {filteredSchools.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => setSelectedSchoolId(school.id)}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-200 ${
                    selectedSchoolId === school.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium">{school.name}</div>
                  <div className="text-sm text-gray-500">{school.prefecture}</div>
                </button>
              ))}
            </div>
          )}

          {selectedSchoolId && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示順
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  コメント
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="この学校についてのコメント（オプション）"
                />
              </div>

              <button
                type="button"
                onClick={handleAddSchool}
                disabled={isAdding}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isAdding ? '追加中...' : '学校を追加'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          関連学校一覧 ({schools.length}件)
        </h3>
        {schools.length === 0 ? (
          <p className="text-gray-500">関連学校がありません</p>
        ) : (
          <div className="space-y-4">
            {schools
              .sort((a, b) => a.display_order - b.display_order)
              .map((articleSchool, index) => (
                <div
                  key={articleSchool.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {articleSchool.school?.name || '学校名不明'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {articleSchool.school?.prefecture}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === schools.length - 1}
                        className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteSchool(
                            articleSchool.school_id,
                            articleSchool.school?.name || 'この学校'
                          )
                        }
                        className="px-2 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <textarea
                      value={articleSchool.note || ''}
                      onChange={(e) => {
                        const newSchools = [...schools];
                        newSchools[index].note = e.target.value;
                        setSchools(newSchools);
                      }}
                      onBlur={() =>
                        handleUpdateSchool(
                          articleSchool.school_id,
                          articleSchool.display_order,
                          articleSchool.note || ''
                        )
                      }
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="コメント（オプション）"
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

