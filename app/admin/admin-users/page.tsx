'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';

interface AdminUser {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'owner' | 'admin'>('admin');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  const fetchAdminUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath('/api/admin/admin-users'));
      if (!response.ok) {
        if (response.status === 403) {
          setError('このページにアクセスするにはowner権限が必要です');
        } else {
          const data = await response.json();
          setError(data.error || '管理者一覧の取得に失敗しました');
        }
        setAdminUsers([]);
        return;
      }
      const data = await response.json();
      setAdminUsers(data.adminUsers || []);
    } catch (err) {
      console.error('管理者一覧取得エラー:', err);
      setError('管理者一覧の取得に失敗しました');
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) {
      alert('メールアドレスを入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiPath('/api/admin/admin-users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          role: newUserRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.details 
          ? `${data.error}\n詳細: ${data.details}${data.code ? `\nコード: ${data.code}` : ''}`
          : data.error || '管理者の追加に失敗しました';
        console.error('管理者追加APIエラー:', data);
        console.error('エラー詳細（デバッグ用）:', JSON.stringify(data, null, 2));
        alert(errorMessage);
        return;
      }

      const result = await response.json();
      console.log('管理者追加成功:', result);
      alert(result.message || '管理者を追加しました。招待メールが送信されました。');
      setNewUserEmail('');
      setNewUserRole('admin');
      setShowAddForm(false);
      fetchAdminUsers();
    } catch (err) {
      console.error('管理者追加エラー:', err);
      alert('管理者の追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (currentStatus && !confirm('この管理者を無効化しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/admin-users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || '状態の更新に失敗しました');
        return;
      }

      fetchAdminUsers();
    } catch (err) {
      console.error('状態更新エラー:', err);
      alert('状態の更新に失敗しました');
    }
  };

  const handleChangeRole = async (id: string, newRole: 'owner' | 'admin') => {
    const currentUser = adminUsers.find((u) => u.id === id);
    if (!currentUser) return;

    // 最後のownerを変更しようとする場合
    const ownerCount = adminUsers.filter((u) => u.role === 'owner' && u.is_active).length;
    if (currentUser.role === 'owner' && ownerCount === 1 && newRole === 'admin') {
      if (!confirm('これが最後のownerです。owner権限を外すと、誰も管理者を管理できなくなります。続行しますか？')) {
        return;
      }
    }

    try {
      const response = await fetch(apiPath(`/api/admin/admin-users/${id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || '権限の更新に失敗しました');
        return;
      }

      fetchAdminUsers();
    } catch (err) {
      console.error('権限更新エラー:', err);
      alert('権限の更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    const user = adminUsers.find((u) => u.id === id);
    if (!user) return;

    // 最後のownerを削除しようとする場合
    const ownerCount = adminUsers.filter((u) => u.role === 'owner' && u.is_active).length;
    if (user.role === 'owner' && ownerCount === 1) {
      alert('最後のownerを削除することはできません');
      return;
    }

    if (!confirm(`「${user.email}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      const response = await fetch(apiPath(`/api/admin/admin-users/${id}`), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || '削除に失敗しました');
        return;
      }

      alert('管理者を削除しました');
      fetchAdminUsers();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">エラーが発生しました</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <Link
              href={appPath('/admin')}
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              管理画面トップに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">管理者管理</h1>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddForm ? 'キャンセル' : '新規追加'}
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">管理者を追加</h2>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    権限
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'owner' | 'admin')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">管理者（admin）</option>
                    <option value="owner">オーナー（owner）</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '追加中...' : '追加'}
                </button>
              </form>
            </div>
          )}

          {adminUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">管理者が見つかりませんでした</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メールアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      権限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作成日
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <label htmlFor={`role-${user.id}`} className="sr-only">
                          権限を変更
                        </label>
                        <select
                          id={`role-${user.id}`}
                          name={`role-${user.id}`}
                          value={user.role}
                          onChange={(e) =>
                            handleChangeRole(user.id, e.target.value as 'owner' | 'admin')
                          }
                          autoComplete="off"
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="admin">管理者（admin）</option>
                          <option value="owner">オーナー（owner）</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_active ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            有効
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            無効
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            className={`px-3 py-1 rounded transition-colors ${
                              user.is_active
                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {user.is_active ? '無効化' : '有効化'}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
