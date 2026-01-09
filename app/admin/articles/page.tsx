'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  slug: string;
  category: 'interview' | 'useful_info';
  excerpt: string | null;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function ArticlesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get('category') || ''
  );

  const limit = 20;

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:35',message:'useEffect実行:fetchArticles呼び出し',data:{page,searchQuery,categoryFilter},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('[ArticlesPage] useEffect実行:', { page, searchQuery, categoryFilter });
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, categoryFilter]);

  const fetchArticles = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:40',message:'fetchArticles開始',data:{page,searchQuery,categoryFilter,limit},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('[ArticlesPage] fetchArticles開始');
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      if (categoryFilter) {
        params.append('category', categoryFilter);
      }

      const apiUrl = `/api/admin/articles?${params.toString()}`;
      console.log('[ArticlesPage] APIリクエスト:', apiUrl);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:55',message:'APIリクエスト送信前',data:{apiUrl,params:params.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      const response = await fetch(apiUrl);
      
      console.log('[ArticlesPage] APIレスポンス:', response.status, response.statusText);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:62',message:'APIレスポンス受信',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '記事一覧の取得に失敗しました' }));
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:66',message:'APIエラー検出',data:{status:response.status,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw new Error(errorData.error || `記事一覧の取得に失敗しました (${response.status})`);
      }

      const data = await response.json();
      console.log('[ArticlesPage] APIデータ:', { articlesCount: data.articles?.length || 0, total: data.total, totalPages: data.total_pages });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:72',message:'APIデータ処理',data:{articlesCount:data.articles?.length||0,total:data.total||0,totalPages:data.total_pages||1,hasArticles:!!data.articles},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      setArticles(data.articles || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('[ArticlesPage] 記事一覧取得エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '記事一覧の取得に失敗しました';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:79',message:'エラー発生',data:{errorMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setError(errorMessage);
      setArticles([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      console.log('[ArticlesPage] fetchArticles完了');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('q', searchQuery);
    }
    if (categoryFilter) {
      params.append('category', categoryFilter);
    }
    router.push(`/admin/articles?${params.toString()}`);
    fetchArticles();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('記事の削除に失敗しました');
      }

      alert('記事を削除しました');
      fetchArticles();
    } catch (error) {
      console.error('記事削除エラー:', error);
      alert('記事の削除に失敗しました');
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'interview':
        return 'リアル体験談 クチコミ・インタビュー';
      case 'useful_info':
        return '通信制高校お役立ち情報';
      default:
        return category;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">記事管理</h1>
            <Link
              href="/admin/articles/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              新規作成
            </Link>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="記事タイトルで検索"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:w-64">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべてのカテゴリ</option>
                <option value="interview">リアル体験談 クチコミ・インタビュー</option>
                <option value="useful_info">通信制高校お役立ち情報</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              検索
            </button>
          </form>

          {total > 0 && (
            <p className="text-gray-600">
              {total}件の記事が見つかりました
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">エラーが発生しました</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => fetchArticles()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              再試行
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">記事が見つかりませんでした</p>
          </div>
        ) : (
          <>
            {/* #region agent log */}
            {console.log('[ArticlesPage] 記事一覧レンダリング:', { articlesCount: articles.length, total, loading, error })}
            {/* #endregion */}
            {/* #region agent log */}
            {fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:195',message:'記事一覧レンダリング開始',data:{articlesCount:articles.length,total,loading,error:error||null},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'E'})}).catch(()=>{})}
            {/* #endregion */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      タイトル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      カテゴリ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      公開日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      更新日
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {articles.map((article) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:223',message:'記事行レンダリング',data:{articleId:article.id,articleTitle:article.title,hasEditButton:true},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'F'})}).catch(()=>{});
                    // #endregion
                    return (
                      <tr 
                        key={article.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          console.log('[ArticlesPage] 記事行クリック:', article.id);
                          // #region agent log
                          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:227',message:'記事行クリックイベント',data:{articleId:article.id,articleTitle:article.title},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'G'})}).catch(()=>{});
                          // #endregion
                          router.push(`/admin/articles/${article.id}/edit`);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {article.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {article.slug}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {getCategoryLabel(article.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {article.is_public ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              公開中
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              非公開
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString('ja-JP')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(article.updated_at).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('[ArticlesPage] 編集ボタンクリック:', article.id);
                                // #region agent log
                                fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/articles/page.tsx:265',message:'編集ボタンクリックイベント',data:{articleId:article.id,articleTitle:article.title},timestamp:Date.now(),sessionId:'debug-session',runId:'article-edit-debug',hypothesisId:'H'})}).catch(()=>{});
                                // #endregion
                                router.push(`/admin/articles/${article.id}/edit`);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              編集
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(article.id, article.title);
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
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
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <ArticlesPageContent />
    </Suspense>
  );
}




