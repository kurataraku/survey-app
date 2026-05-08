'use client';

import type { AttendanceStyle } from '@/lib/simulator/types';

interface Props {
  onSelect: (style: AttendanceStyle) => void;
}

const options: {
  style: AttendanceStyle;
  emoji: string;
  label: string;
  sub: string;
  tags: string[];
  gradient: string;
  tagBg: string;
  arrowBg: string;
}[] = [
  {
    style: 'commute',
    emoji: '🏫',
    label: '通学中心',
    sub: '週に何度か学校へ行かせたい',
    tags: ['週2〜5日登校', '友達と交流', 'スクーリング充実'],
    gradient: 'from-sky-400 to-blue-500',
    tagBg: 'bg-sky-100 text-sky-700',
    arrowBg: 'bg-sky-500',
  },
  {
    style: 'online',
    emoji: '💻',
    label: 'オンライン中心',
    sub: '自宅で学ばせたい・登校は最小限に',
    tags: ['月数回のスクーリング', '自由な時間割', '在宅学習メイン'],
    gradient: 'from-violet-400 to-indigo-500',
    tagBg: 'bg-violet-100 text-violet-700',
    arrowBg: 'bg-violet-500',
  },
];

export default function StepSchoolType({ onSelect }: Props) {
  return (
    <div className="pb-8">
      {/* ヘッダー */}
      <div className="text-center mb-6">
        <span className="inline-block bg-sky-100 text-sky-600 text-sm font-black px-4 py-1.5 rounded-full mb-4">
          STEP 1 / 2
        </span>
        <h2 className="text-[26px] font-black text-gray-900 leading-snug mb-2">
          お子さんはどんな<br />通い方をイメージしていますか？
        </h2>
        <p className="text-base text-gray-500 font-medium">
          お子さんの希望に近い方を選んでください。正解はありません。
        </p>
      </div>

      {/* 選択カード */}
      <div className="flex flex-col gap-4">
        {options.map(opt => (
          <button
            key={opt.style}
            onClick={() => onSelect(opt.style)}
            className="group bg-white rounded-3xl overflow-hidden shadow-md border border-gray-100 text-left transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none"
          >
            {/* グラデーションヘッダー */}
            <div className={`bg-gradient-to-r ${opt.gradient} px-5 py-4 flex items-center gap-4`}>
              <span className="text-5xl">{opt.emoji}</span>
              <div>
                <p className="text-2xl font-black text-white">{opt.label}</p>
                <p className="text-white/80 text-sm font-medium mt-0.5">{opt.sub}</p>
              </div>
            </div>

            {/* タグとアロー */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {opt.tags.map(tag => (
                  <span key={tag} className={`text-sm px-3 py-1 rounded-full font-bold ${opt.tagBg}`}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className={`shrink-0 w-10 h-10 rounded-full ${opt.arrowBg} flex items-center justify-center ml-3 shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-sm text-gray-400 font-medium">
        どちらか近い方を選んでください
      </p>
    </div>
  );
}
