'use client';

import { useEffect } from 'react';
import type { AttendanceStyle } from '@/lib/simulator/types';
import { scenarios } from '@/lib/simulator/scenarios';

interface Props {
  attendanceStyle: AttendanceStyle;
  dayChoices: ('A' | 'B')[];
  showNarration: boolean;
  pendingChoice: 'A' | 'B' | null;
  onChoice: (choice: 'A' | 'B') => void;
  onNarrationNext: () => void;
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

export default function StepSimulation({
  attendanceStyle,
  dayChoices,
  showNarration,
  pendingChoice,
  onChoice,
  onNarrationNext,
}: Props) {
  const scenarioList = scenarios[attendanceStyle];
  const dayIndex = Math.min(dayChoices.length, scenarioList.length - 1);
  const scenario = scenarioList[dayIndex];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [dayIndex, showNarration]);

  if (!scenario) return null;

  const chosenOption = pendingChoice === 'A' ? scenario.choiceA : scenario.choiceB;
  const isLastDay = dayChoices.length >= 6 && showNarration;
  const completedCount = dayChoices.length + (showNarration ? 1 : 0);

  return (
    <div className="pb-8">
      {/* 進捗バー */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-black text-gray-800">
            {scenario.day}のできごと
          </span>
          <span className="text-sm font-bold text-sky-500 bg-sky-50 px-3 py-1 rounded-full">
            {completedCount} / 7日
          </span>
        </div>
        <div className="flex gap-1.5 mb-3">
          {DAY_LABELS.map((d, i) => {
            const done = i < dayChoices.length || (showNarration && i === dayChoices.length);
            const current = !showNarration && i === dayIndex;
            return (
              <div
                key={d}
                className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                  done
                    ? 'bg-gradient-to-b from-sky-400 to-blue-500 text-white shadow-sm'
                    : current
                    ? 'bg-sky-100 text-sky-600 ring-2 ring-sky-400'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${(completedCount / 7) * 100}%` }}
          />
        </div>
      </div>

      {!showNarration ? (
        <div className="animate-in fade-in duration-300">
          {/* テーマ */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-sm font-black px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              {scenario.theme}
            </span>
          </div>

          {/* シーンカード */}
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-3xl p-5 mb-5">
            <p className="text-xs font-black text-sky-500 mb-2 tracking-wide">📍 こんな場面</p>
            <p className="text-[17px] text-gray-800 leading-relaxed font-medium">{scenario.situation}</p>
          </div>

          {/* 選択プロンプト */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-base font-black text-gray-700 whitespace-nowrap">お子さんに近いのは？</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* 選択肢 */}
          <div className="flex flex-col gap-3">
            {(['A', 'B'] as const).map(choice => {
              const opt = choice === 'A' ? scenario.choiceA : scenario.choiceB;
              const isA = choice === 'A';
              return (
                <button
                  key={choice}
                  onClick={() => onChoice(choice)}
                  className={`group bg-white rounded-2xl border-2 border-gray-200 p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    isA ? 'hover:border-sky-400 hover:bg-sky-50 hover:shadow-lg hover:shadow-sky-100'
                        : 'hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base font-black transition-all ${
                      isA
                        ? 'bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white'
                        : 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white'
                    }`}>
                      {choice}
                    </span>
                    <p className="text-[15px] text-gray-700 leading-relaxed pt-1 font-medium">{opt.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ナレーション */
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
          <div className="bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 rounded-3xl p-5 mb-5 shadow-lg shadow-blue-200">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl shrink-0">💡</span>
              <div>
                <p className="text-white/80 text-sm font-bold mb-1">
                  選択 {pendingChoice}：{chosenOption?.label?.slice(0, 18)}…
                </p>
                <p className="text-white text-base leading-relaxed font-medium">{chosenOption?.narration}</p>
              </div>
            </div>
          </div>

          <button
            onClick={onNarrationNext}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xl py-5 rounded-2xl shadow-lg shadow-sky-200 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
          >
            {isLastDay ? '✦ 診断結果を見る' : '次の日へ →'}
          </button>
        </div>
      )}
    </div>
  );
}
