'use client';

import { useState, useEffect } from 'react';
import type { AttendanceStyle, SimScore, SimulatorState } from '@/lib/simulator/types';
import { calcScore, axisMap } from '@/lib/simulator/scoring';
import StepOpening from './StepOpening';
import StepSchoolType from './StepSchoolType';
import StepSimulation from './StepSimulation';
import StepResult from './StepResult';
import StepGuide from './StepGuide';

const TOTAL_STEPS = 5; // 0=opening, 1=schoolType, 2=simulation, 3=result, 4=guide

export default function LifeSimulator() {
  const [state, setState] = useState<SimulatorState>({
    step: 0,
    situation: '',
    attendanceStyle: null,
    dayChoices: [],
    scores: { support: 0, autonomy: 0, community: 0 },
    showNarration: false,
    pendingChoice: null,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.step]);

  function goTo(step: number) {
    setState(s => ({ ...s, step }));
  }

  function handleStyleSelect(style: AttendanceStyle) {
    setState(s => ({ ...s, attendanceStyle: style, step: 2 }));
  }

  function handleDayChoice(choice: 'A' | 'B') {
    setState(s => ({
      ...s,
      pendingChoice: choice,
      showNarration: true,
    }));
  }

  function handleNarrationNext() {
    setState(s => {
      if (!s.pendingChoice) return s;
      const newChoices = [...s.dayChoices, s.pendingChoice];
      const newScores = calcScore(newChoices, axisMap);
      const allDone = newChoices.length >= 7;
      return {
        ...s,
        dayChoices: newChoices,
        scores: newScores,
        pendingChoice: null,
        showNarration: false,
        step: allDone ? 3 : s.step,
      };
    });
  }

  function goBack() {
    setState(s => {
      const reset = { dayChoices: [] as ('A' | 'B')[], scores: { support: 0, autonomy: 0, community: 0 } as SimScore, showNarration: false, pendingChoice: null as null };
      if (s.step === 2) {
        if (s.showNarration) {
          // ナレーション表示中 → 同じ日の選択肢に戻る
          return { ...s, showNarration: false, pendingChoice: null };
        }
        if (s.dayChoices.length === 0) {
          // 1日目の選択肢 → 通学スタイル選択に戻る
          return { ...s, step: 1, attendanceStyle: null, ...reset };
        }
        // 2日目以降 → 前の日のナレーションに戻る（最後の選択を取り消す）
        const prevChoices = s.dayChoices.slice(0, -1) as ('A' | 'B')[];
        const prevPendingChoice = s.dayChoices[s.dayChoices.length - 1];
        return {
          ...s,
          dayChoices: prevChoices,
          scores: calcScore(prevChoices, axisMap),
          showNarration: true,
          pendingChoice: prevPendingChoice,
        };
      }
      switch (s.step) {
        case 1: return { ...s, step: 0 };
        case 3: return { ...s, step: 1, attendanceStyle: null, ...reset };
        case 4: return { ...s, step: 3 };
        default: return s;
      }
    });
  }

  function handleRestart() {
    setState({
      step: 0,
      situation: '',
      attendanceStyle: null,
      dayChoices: [],
      scores: { support: 0, autonomy: 0, community: 0 },
      showNarration: false,
      pendingChoice: null,
    });
  }

  const progressPercent = Math.round((state.step / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {state.step > 0 && (
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={goBack}
              className="shrink-0 flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-sm font-black text-gray-600 px-3 py-1.5 rounded-full transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              戻る
            </button>
            {state.step < 4 && (
              <>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {state.step === 2 ? `${state.dayChoices.length + (state.showNarration ? 1 : 0)}/7日` : ''}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-5">
        {state.step === 0 && (
          <StepOpening onStart={() => goTo(1)} />
        )}
        {state.step === 1 && (
          <StepSchoolType onSelect={handleStyleSelect} />
        )}
        {state.step === 2 && state.attendanceStyle && (
          <StepSimulation
            attendanceStyle={state.attendanceStyle}
            dayChoices={state.dayChoices}
            showNarration={state.showNarration}
            pendingChoice={state.pendingChoice}
            onChoice={handleDayChoice}
            onNarrationNext={handleNarrationNext}
          />
        )}
        {state.step === 3 && state.attendanceStyle && (
          <StepResult
            scores={state.scores}
            attendanceStyle={state.attendanceStyle}
            onNext={() => goTo(4)}
          />
        )}
        {state.step === 4 && state.attendanceStyle && (
          <StepGuide
            scores={state.scores}
            attendanceStyle={state.attendanceStyle}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
