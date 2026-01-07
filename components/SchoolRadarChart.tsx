'use client';

import React from 'react';

type Metric = {
  label: string;
  schoolValue: number | null | undefined;
  globalValue: number | null | undefined;
};

interface SchoolRadarChartProps {
  metrics: Metric[];
}

export default function SchoolRadarChart({ metrics }: SchoolRadarChartProps) {
  const validMetrics = metrics.filter(
    (m) =>
      m.schoolValue !== null &&
      m.schoolValue !== undefined &&
      m.globalValue !== null &&
      m.globalValue !== undefined
  );

  if (validMetrics.length === 0) {
    return null;
  }

  // レーダーチャートのサイズを大きくする
  const size = 360;
  const center = size / 2;
  const radius = size / 2 - 50; // ラベル用の余白を確保
  const maxValue = 5;
  const angleStep = (Math.PI * 2) / validMetrics.length;

  // ラベルを短縮する関数
  const getShortLabel = (label: string): string => {
    const shortLabels: Record<string, string> = {
      '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）': '学びの柔軟さ',
      '先生・職員の対応': '先生・職員',
      '心や体調の波・不安などに対するサポート': '心・体調サポート',
      '在校生の雰囲気': '在校生の雰囲気',
      '単位取得のしやすさ': '単位取得',
      '学校独自の授業・コースの充実度': '独自授業・コース',
      '進学・就職など進路サポートの手厚さ': '進路サポート',
      '授業以外の学校行事やキャンパスライフ': 'キャンパスライフ',
      '学費の納得感': '学費の納得感',
    };
    return shortLabels[label] || (label.length > 8 ? label.slice(0, 8) + '…' : label);
  };

  const getXY = (value: number, index: number) => {
    const angle = -Math.PI / 2 + angleStep * index;
    const r = (value / maxValue) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const schoolPoints = validMetrics
    .map((m, i) => {
      const { x, y } = getXY(m.schoolValue as number, i);
      return `${x},${y}`;
    })
    .join(' ');

  const globalPoints = validMetrics
    .map((m, i) => {
      const { x, y } = getXY(m.globalValue as number, i);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">
        図で見る（サイト全体平均との比較）
      </h3>
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* viewBoxを拡大してラベルが見切れないようにする */}
        <svg width={size} height={size} viewBox={`-20 -20 ${size + 40} ${size + 40}`} className="overflow-visible">
          {/* ガイドライン（放射状）＋短い軸ラベル */}
          {validMetrics.map((metric, i) => {
            const angle = -Math.PI / 2 + angleStep * i;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);

            // ラベルをより外側に配置（余白を確保）
            const labelRadius = radius + 20;
            const lx = center + labelRadius * Math.cos(angle);
            const ly = center + labelRadius * Math.sin(angle);
            const shortLabel = getShortLabel(metric.label);

            return (
              <g key={`axis-${i}`}>
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#6B7280"
                  className="font-medium"
                >
                  <title>{metric.label}</title>
                  {shortLabel}
                </text>
              </g>
            );
          })}

          {/* 同心円（グリッド）＋目盛り */}
          {[1, 2, 3, 4, 5].map((level) => {
            const r = (level / maxValue) * radius;
            return (
              <g key={`grid-${level}`}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth={0.5}
                />
                <text
                  x={center}
                  y={center - r}
                  dy={-2}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#9CA3AF"
                >
                  {level}
                </text>
              </g>
            );
          })}

          {/* サイト全体平均 */}
          <polygon
            points={globalPoints}
            fill="rgba(148, 163, 184, 0.25)"
            stroke="#94A3B8"
            strokeWidth={1.5}
          />

          {/* この学校の平均 */}
          <polygon
            points={schoolPoints}
            fill="rgba(59, 130, 246, 0.3)"
            stroke="#2563EB"
            strokeWidth={1.5}
          />

          {/* 各頂点にドット＋ブラウザツールチップ */}
          {validMetrics.map((metric, i) => {
            const school = getXY(metric.schoolValue as number, i);
            const global = getXY(metric.globalValue as number, i);
            return (
              <g key={`points-${i}`}>
                <circle cx={global.x} cy={global.y} r={3} fill="#64748B">
                  <title>
                    サイト全体平均: {metric.label}{' '}
                    {metric.globalValue?.toFixed(1)}
                  </title>
                </circle>
                <circle cx={school.x} cy={school.y} r={3} fill="#2563EB">
                  <title>
                    この学校: {metric.label} {metric.schoolValue?.toFixed(1)}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>

        {/* 凡例 */}
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            <span>この学校の平均</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-slate-400" />
            <span>サイト全体の平均</span>
          </div>
        </div>
      </div>
    </div>
  );
}


