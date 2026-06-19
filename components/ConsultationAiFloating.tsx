'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ConsultationAiChat from '@/components/ConsultationAiChat';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export default function ConsultationAiFloating() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isHover, setIsHover] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      trackEvent(GA_EVENTS.consultationAiOpen, { source: 'event_dispatch' });
    };
    window.addEventListener('open-consultation-ai', handler);
    return () => window.removeEventListener('open-consultation-ai', handler);
  }, []);

  const openPanel = (source: string) => {
    setIsOpen(true);
    trackEvent(GA_EVENTS.consultationAiOpen, { source });
  };

  if (pathname?.endsWith('/consultation-ai')) return null;

  return (
    <>
      <div className="hidden md:block fixed bottom-6 right-6 z-[70]">
        {!isOpen && (
          <button
            type="button"
            onClick={() => openPanel('floating_button_desktop')}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-white shadow-lg hover:shadow-xl"
            aria-label="通信制高校えらび相談AIを開く"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
              💬
            </span>
            <span
              className={`overflow-hidden text-left transition-all duration-200 ${
                isHover ? 'max-w-[220px] opacity-100' : 'max-w-0 opacity-0'
              }`}
            >
              <span className="block whitespace-nowrap text-xs font-semibold text-white/90">
                通信制高校えらび相談AI
              </span>
              <span className="block whitespace-nowrap text-sm font-black">学校選びを口コミで整理</span>
            </span>
          </button>
        )}
      </div>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-[70] p-3">
        {!isOpen && (
          <button
            type="button"
            onClick={() => openPanel('floating_button_mobile')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg"
            aria-label="通信制高校えらび相談AIを開く"
          >
            <span>💬</span>
            通信制高校えらび相談AIを使う
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-black/30 md:bg-transparent md:items-end md:justify-end md:p-6">
          <div className="flex h-[82vh] w-full max-w-[440px] flex-col rounded-t-3xl bg-white shadow-2xl md:h-[74vh] md:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-blue-600">通信制高校えらび相談AI</p>
                <h2 className="text-sm font-black text-gray-900">お子さまに合う学校選びを口コミで整理</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="閉じる"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <ConsultationAiChat compact source="floating_panel" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
