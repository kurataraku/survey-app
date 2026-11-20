'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';

interface Notice {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_published: boolean;
  published_at: string;
}

interface NoticeForm {
  title: string;
  body: string;
  link_url: string;
  is_published: boolean;
  published_at: string; // datetime-local 形式（ブラウザのローカル時刻）
}

/** ISO → datetime-local 用文字列 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const newForm = (): NoticeForm => ({
  title: '',
  body: '',
  link_url: '',
  is_published: true,
  published_at: toLocalInput(new Date().toISOString()),
});

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeForm>(newForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiPath('/api/admin/notices'));
    const json = await res.json();
    setNotices(json.notices ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch(apiPath('/api/admin/notices'))
      .then((res) => res.json())
      .then((json) => {
        setNotices(json.notices ?? []);
        setLoading(false);
      });
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(newForm());
    setError(null);
    setShowForm(true);
  };

  const openEdit = (n: Notice) => {
    setEditingId(n.id);
    setForm({
      title: n.title,
      body: n.body ?? '',
      link_url: n.link_url ?? '',
      is_published: n.is_published,
      published_at: toLocalInput(n.published_at),
    });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(
      apiPath(editingId ? `/api/admin/notices/${editingId}` : '/api/admin/notices'),
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          published_at: new Date(form.published_at).toISOString(),
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? '保存に失敗しました');
      return;
    }
    closeForm();
    load();
  };

  const togglePublished = async (n: Notice) => {
    await fetch(apiPath(`/api/admin/notices/${n.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !n.is_published }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    await fetch(apiPath(`/api/admin/notices/${id}`), { method: 'DELETE' });
    load();
  };

  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
          <button
            onClick={openNew}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + 新規作成
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">
              {editingId ? 'お知らせを編集' : '新規お知らせ'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイトル（必須）</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例: PR HEADLINE に掲載されました"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">補足（任意）</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  リンク先URL（任意。タイトルがリンクになります）
                </label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://... または /my-story-award"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  表示日（未来の日時にすると、その時刻まで表示されません）
                </label>
                <input
                  type="datetime-local"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  value={form.published_at}
                  onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="notice_is_published"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                />
                <label htmlFor="notice_is_published" className="text-sm text-gray-700">公開する</label>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving || !form.title.trim() || !form.published_at}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-12">読み込み中...</p>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">お知らせはまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => {
              const scheduled = n.is_published && new Date(n.published_at) > now;
              return (
                <div
                  key={n.id}
                  className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{n.title}</span>
                      {n.is_published && !scheduled && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">公開中</span>
                      )}
                      {scheduled && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">公開予約</span>
                      )}
                      {!n.is_published && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">非公開</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      表示日 {new Date(n.published_at).toLocaleString('ja-JP')}
                    </p>
                    {n.link_url && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">リンク: {n.link_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(n)}
                      className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => togglePublished(n)}
                      className={`px-3 py-1 text-xs rounded border ${n.is_published ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                    >
                      {n.is_published ? '非公開にする' : '公開する'}
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="px-3 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
