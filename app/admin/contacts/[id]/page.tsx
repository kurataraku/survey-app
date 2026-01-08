'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ContactMessage {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  subject: string;
  message: string;
  page_url: string | null;
  is_read: boolean;
  ip: string | null;
  user_agent: string | null;
}

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<ContactMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContact();
    }
  }, [id]);

  const fetchContact = async () => {
    setIsLoading(true);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/contacts/[id]/page.tsx:35',message:'fetchContact called',data:{id,idType:typeof id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      const response = await fetch(`/api/admin/contacts/${id}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/contacts/[id]/page.tsx:39',message:'Response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,url:response.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const data = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/contacts/[id]/page.tsx:42',message:'Response data parsed',data:{hasContact:!!data.contact,hasError:!!data.error,errorMessage:data.error,errorDetails:data.details,contactId:data.contact?.id,requestedId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!response.ok) {
        const errorMessage = data.error || '問い合わせの取得に失敗しました';
        const errorDetails = data.details ? ` (${data.details})` : '';
        throw new Error(errorMessage + errorDetails);
      }
      
      if (!data.contact) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/contacts/[id]/page.tsx:50',message:'Contact data is null/undefined',data:{requestedId:id,responseData:JSON.stringify(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw new Error('問い合わせデータが見つかりませんでした');
      }
      
      setContact(data.contact);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/contacts/[id]/page.tsx:48',message:'Error in fetchContact',data:{errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('問い合わせ取得エラー:', error);
      alert('問い合わせの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReadStatus = async () => {
    if (!contact) return;

    setIsToggling(true);
    try {
      const response = await fetch(`/api/admin/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_read: !contact.is_read,
        }),
      });

      if (!response.ok) {
        throw new Error('既読状態の更新に失敗しました');
      }

      setContact((prev) => (prev ? { ...prev, is_read: !prev.is_read } : null));
    } catch (error) {
      console.error('既読状態更新エラー:', error);
      alert('既読状態の更新に失敗しました');
    } finally {
      setIsToggling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">問い合わせが見つかりませんでした</p>
            <Link
              href="/admin/contacts"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700"
            >
              一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/contacts')}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            一覧に戻る
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">問い合わせ詳細</h1>
            <button
              onClick={toggleReadStatus}
              disabled={isToggling}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                contact.is_read
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {isToggling ? '更新中...' : contact.is_read ? '未読にする' : '既読にする'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                contact.is_read
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {contact.is_read ? '既読' : '未読'}
            </span>
            <span className="text-sm text-gray-500">問い合わせID: {contact.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">受信日時</label>
              <p className="text-gray-900">{formatDate(contact.created_at)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">お名前</label>
              <p className="text-gray-900">{contact.name || '（未入力）'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <p className="text-gray-900">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {contact.email}
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
              <p className="text-gray-900">{contact.subject}</p>
            </div>

            {contact.page_url && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">対象ページURL</label>
                <p className="text-gray-900">
                  <a
                    href={contact.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline break-all"
                  >
                    {contact.page_url}
                  </a>
                </p>
              </div>
            )}

            {contact.ip && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IPアドレス</label>
                <p className="text-gray-900 font-mono text-sm">{contact.ip}</p>
              </div>
            )}

            {contact.user_agent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User-Agent</label>
                <p className="text-gray-900 font-mono text-xs break-all">{contact.user_agent}</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">お問い合わせ内容</label>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{contact.message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
