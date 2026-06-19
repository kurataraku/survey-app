'use client';

import { useState } from 'react';
import ConsultationAiChat from '@/components/ConsultationAiChat';

export default function ConsultationAiPageClient() {
  const [hasConversationStarted, setHasConversationStarted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
        {!hasConversationStarted && (
          <div className="mb-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
            <p className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
              通信制高校えらび相談AI
            </p>
            <h1 className="mt-3 text-xl font-black leading-snug text-gray-900 sm:text-2xl">
              お子さまに合う通信制高校選びを、口コミベースで整理
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-gray-700 sm:text-sm">
              通学頻度・サポート体制・学習スタイルなどの希望条件をもとに、公開口コミや学校情報から
              比較の観点と候補校を整理します。最終判断は必ず学校説明会・公式資料でも確認してください。
            </p>
          </div>
        )}

        <div
          className={`rounded-3xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4 ${
            hasConversationStarted
              ? 'h-[calc(100vh-150px)] min-h-[560px] lg:h-[calc(100vh-180px)]'
              : 'h-[360px] sm:h-[400px] lg:h-[440px]'
          }`}
        >
          <ConsultationAiChat
            source="consultation_ai_page"
            onConversationStart={() => setHasConversationStarted(true)}
          />
        </div>
      </div>
    </div>
  );
}
