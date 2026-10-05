import type { Metadata } from 'next';
import UnsubscribeForm from '@/components/UnsubscribeForm';

export const metadata: Metadata = {
  title: '配信停止 | 通信制高校リアルレビュー',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">ご案内メールの配信停止</h1>
        {e && t ? (
          <UnsubscribeForm e={e} t={t} />
        ) : (
          <p className="text-sm text-gray-700">
            配信停止リンクが正しくありません。お手数ですが、メールに記載のリンクから再度お試しください。
          </p>
        )}
      </div>
    </div>
  );
}
