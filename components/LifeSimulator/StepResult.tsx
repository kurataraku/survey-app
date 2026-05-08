'use client';

import Link from 'next/link';
import type { AttendanceStyle, SimScore } from '@/lib/simulator/types';
import { normalizeScore, getTopAxis, resultTypes } from '@/lib/simulator/scoring';
import { getRecommendations } from '@/lib/simulator/recommendations';
import { appPath } from '@/lib/base-path';

interface Props {
  scores: SimScore;
  attendanceStyle: AttendanceStyle;
  onNext: () => void;
}

const AXIS_META: Record<string, { label: string; short: string; angle: number }> = {
  support:   { label: 'サポート・安心', short: 'サポート\n安心',   angle: -90 },
  autonomy:  { label: '自律・自由度',   short: '自律\n自由度',     angle: 30  },
  community: { label: '仲間・行事',     short: '仲間\n行事',       angle: 150 },
};

const TYPE_CONFIG: Record<string, { emoji: string; gradient: string; badge: string; ring: string; color: string }> = {
  support:   { emoji: '🤝', gradient: 'from-sky-400 via-blue-500 to-indigo-500',   badge: 'bg-blue-100 text-blue-700',    ring: 'border-blue-200',   color: '#6366f1' },
  autonomy:  { emoji: '🌿', gradient: 'from-teal-400 via-emerald-500 to-green-500', badge: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-200', color: '#10b981' },
  community: { emoji: '👥', gradient: 'from-amber-400 via-orange-400 to-rose-400',  badge: 'bg-amber-100 text-amber-700',   ring: 'border-amber-200',   color: '#f59e0b' },
};

function RadarChart({ normalized, topAxis }: { normalized: SimScore; topAxis: string }) {
  const W = 280;
  const H = 270;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const r = 90;
  const accentColor = TYPE_CONFIG[topAxis].color;

  const axes = ['support', 'autonomy', 'community'] as const;

  function polar(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const dataPoints = axes.map(axis => {
    const val = (normalized[axis] / 10) * r;
    return polar(AXIS_META[axis].angle, Math.max(val, 4));
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mx-auto" overflow="visible">
      {gridLevels.map(level => {
        const pts = axes.map(axis => polar(AXIS_META[axis].angle, r * level));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
        return <path key={level} d={d} fill="none" stroke="#e5e7eb" strokeWidth="1.5" />;
      })}

      {axes.map(axis => {
        const end = polar(AXIS_META[axis].angle, r);
        return <line key={axis} x1={cx} y1={cy} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="#e5e7eb" strokeWidth="1.5" />;
      })}

      <path d={dataPath} fill={`${accentColor}25`} stroke={accentColor} strokeWidth="3" strokeLinejoin="round" />

      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="6" fill={accentColor} stroke="white" strokeWidth="2.5" />
      ))}

      {axes.map(axis => {
        const pos = polar(AXIS_META[axis].angle, r + 34);
        const lines = AXIS_META[axis].short.split('\n');
        return (
          <text key={axis} x={pos.x.toFixed(1)} y={pos.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle">
            {lines.map((line, li) => (
              <tspan key={li} x={pos.x.toFixed(1)} dy={li === 0 ? `-${(lines.length - 1) * 7}` : '15'}
                fontSize="13" fontWeight="800" fill="#374151">{line}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

export default function StepResult({ scores, attendanceStyle, onNext }: Props) {
  const normalized = normalizeScore(scores);
  const topAxis = getTopAxis(normalized);
  const result = resultTypes[topAxis];
  const recommendations = getRecommendations(attendanceStyle, topAxis);
  const config = TYPE_CONFIG[topAxis];

  return (
    <div className="pb-8">
      {/* Result hero */}
      <div className={`bg-gradient-to-br ${config.gradient} rounded-3xl p-6 mb-5 text-center shadow-lg`}>
        <p className="text-white/70 text-xs font-black mb-3 tracking-widest">RESULT</p>
        <div className="text-7xl mb-4">{config.emoji}</div>
        <p className="text-white/80 text-base font-bold mb-2">お子さんは</p>
        <h2 className="text-[28px] font-black text-white mb-3 leading-tight">{result.title}</h2>
        <p className="text-white/90 text-[16px] leading-relaxed font-medium">{result.description}</p>
      </div>

      {/* Radar chart */}
      <div className="bg-white rounded-3xl shadow-md border border-gray-100 px-4 pt-5 pb-4 mb-5">
        <p className="text-sm font-black text-gray-500 text-center mb-3">3つの軸のスコア（10点満点）</p>
        <RadarChart normalized={normalized} topAxis={topAxis} />
        <div className="flex justify-center gap-5 mt-2">
          {(['support', 'autonomy', 'community'] as const).map(axis => (
            <div key={axis} className="text-center">
              <p className="text-xs text-gray-400 mb-1">{AXIS_META[axis].label}</p>
              <p className={`text-[22px] font-black ${axis === topAxis ? 'text-indigo-600' : 'text-gray-400'}`}>
                {normalized[axis]}<span className="text-xs font-normal text-gray-400">/10</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* School feature */}
      <div className={`bg-gradient-to-r from-sky-50 to-blue-50 border-2 ${config.ring} rounded-2xl p-4 mb-5`}>
        <p className="text-xs font-black text-sky-500 mb-2">🏫 お子さんに向いている学校の特徴</p>
        <p className="text-[16px] font-bold text-gray-800 leading-relaxed">{result.schoolFeature}</p>
      </div>

      {/* School recommendations */}
      <div className="mb-6">
        <h3 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2">
          <span className={`w-1.5 h-6 rounded-full bg-gradient-to-b ${config.gradient} inline-block shrink-0`} />
          お子さんの傾向に近い口コミが多い学校
        </h3>
        <div className="flex flex-col gap-3">
          {recommendations.map((school, i) => (
            <Link
              key={school.slug}
              href={appPath(`/schools/${school.slug}`)}
              className="group bg-white border-2 border-gray-100 rounded-2xl p-4 transition-all hover:border-sky-300 hover:shadow-lg hover:shadow-sky-50 active:scale-[0.98]"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-sky-100 text-sm font-black text-sky-600 flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-black text-gray-900 mb-1 group-hover:text-sky-600 transition-colors leading-snug">
                    {school.name}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">{school.description}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-sky-400 shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 text-white rounded-3xl p-6 text-center shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
      >
        <div className="text-5xl mb-2">🎉</div>
        <p className="text-[26px] font-black mb-1">診断完了！</p>
        <p className="text-white/85 text-base font-medium">お子さんに合う学校をさらに探しましょう</p>
      </button>
    </div>
  );
}
