import { ATTENDANCE_SATISFACTION_DATA } from '@/lib/press-releases';

/** 報道資料向けの折れ線図。装飾を排し、谷の形が一目で分かるようにする。 */
export default function PressSatisfactionValleyChart() {
  const width = 640;
  const height = 320;
  const pad = { top: 28, right: 24, bottom: 72, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMin = 70;
  const yMax = 100;
  const points = ATTENDANCE_SATISFACTION_DATA.map((item, index) => {
    const x = pad.left + (index / (ATTENDANCE_SATISFACTION_DATA.length - 1)) * plotW;
    const y =
      pad.top + ((yMax - item.value) / (yMax - yMin)) * plotH;
    return { ...item, x, y, shortLabel: shortLabel(item.label) };
  });
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const yTicks = [70, 80, 90, 100];

  return (
    <figure className="mt-6">
      <figcaption className="mb-3 text-sm font-semibold text-neutral-900">
        図1. 主な通学頻度別・総合満足度4〜5の割合（単位：％／有効回答849件）
      </figcaption>

      <div className="border border-neutral-800 bg-white px-2 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby="valley-chart-title valley-chart-desc"
        >
          <title id="valley-chart-title">
            通学頻度別の高満足率。月1〜数回だけ79.2％まで低下する谷型
          </title>
          <desc id="valley-chart-desc">
            ほぼオンライン94.3％、月1〜数回79.2％、週1〜2は92.1％、週3〜4は90.1％、週5は94.3％
          </desc>

          {yTicks.map((tick) => {
            const y = pad.top + ((yMax - tick) / (yMax - yMin)) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#d4d4d4"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#595959"
                  fontSize="12"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={pad.top + plotH}
            stroke="#1a1a1a"
            strokeWidth="1.25"
          />
          <line
            x1={pad.left}
            y1={pad.top + plotH}
            x2={width - pad.right}
            y2={pad.top + plotH}
            stroke="#1a1a1a"
            strokeWidth="1.25"
          />

          <path d={path} fill="none" stroke="#1a1a1a" strokeWidth="2" />

          {points.map((point) => {
            const isValley = 'highlighted' in point && point.highlighted;
            return (
              <g key={point.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isValley ? 5.5 : 4}
                  fill={isValley ? '#1a1a1a' : '#ffffff'}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={point.y - (isValley ? 14 : 12)}
                  textAnchor="middle"
                  fill="#1a1a1a"
                  fontSize={isValley ? '13' : '12'}
                  fontWeight={isValley ? '700' : '500'}
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {point.value}％
                </text>
                <text
                  x={point.x}
                  y={pad.top + plotH + 22}
                  textAnchor="middle"
                  fill="#1a1a1a"
                  fontSize="12"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {point.shortLabel[0]}
                </text>
                {point.shortLabel[1] ? (
                  <text
                    x={point.x}
                    y={pad.top + plotH + 38}
                    textAnchor="middle"
                    fill="#1a1a1a"
                    fontSize="12"
                    fontFamily="var(--font-press-sans), sans-serif"
                  >
                    {point.shortLabel[1]}
                  </text>
                ) : null}
                {isValley ? (
                  <text
                    x={point.x}
                    y={pad.top + plotH + 56}
                    textAnchor="middle"
                    fill="#595959"
                    fontSize="11"
                    fontFamily="var(--font-press-sans), sans-serif"
                  >
                    （谷）
                  </text>
                ) : null}
              </g>
            );
          })}

          <text
            x={14}
            y={pad.top + plotH / 2}
            fill="#595959"
            fontSize="11"
            fontFamily="var(--font-press-sans), sans-serif"
            transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
            textAnchor="middle"
          >
            高満足率（％）
          </text>
        </svg>
      </div>

      <table className="sr-only">
        <caption>通学頻度別の高満足率と人数</caption>
        <thead>
          <tr>
            <th scope="col">主な通学頻度</th>
            <th scope="col">高満足率</th>
            <th scope="col">人数</th>
          </tr>
        </thead>
        <tbody>
          {ATTENDANCE_SATISFACTION_DATA.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.value}％</td>
              <td>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。縦軸は70〜100％。
      </p>
    </figure>
  );
}

function shortLabel(label: string): [string, string?] {
  switch (label) {
    case 'ほぼオンライン／自宅':
      return ['ほぼ', 'オンライン'];
    case '月1〜数回':
      return ['月1〜', '数回'];
    case '週1〜2':
      return ['週1〜2'];
    case '週3〜4':
      return ['週3〜4'];
    case '週5':
      return ['週5'];
    default:
      return [label];
  }
}
