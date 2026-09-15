import { ATTENDANCE_METRIC_COMPARE } from '@/lib/press-releases';

/**
 * 図2: 3指標×5通学頻度の折れ線。
 * 他4区分を平均に潰さず、すべて出して「月1〜数回が最下位」を示す。
 */
export default function PressMonthlyMetricCompareChart() {
  const { frequencies, series, monthlyLearning } = ATTENDANCE_METRIC_COMPARE;
  const width = 640;
  const height = 360;
  const pad = { top: 24, right: 20, bottom: 78, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMin = 50;
  const yMax = 90;
  const yTicks = [50, 60, 70, 80, 90];
  const valleyIndex = 1;

  const xAt = (i: number) =>
    pad.left + (i / (frequencies.length - 1)) * plotW;
  const yAt = (v: number) =>
    pad.top + ((yMax - v) / (yMax - yMin)) * plotH;

  const shortFreq = (label: string): [string, string?] => {
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
  };

  return (
    <figure className="mt-6">
      <figcaption className="mb-3 text-sm font-semibold text-neutral-900">
        図2. 通学頻度別の個別評価・高評価率（心身サポート／雰囲気／進路）
      </figcaption>

      <div className="border border-neutral-800 bg-white px-2 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby="metric-compare-title metric-compare-desc"
        >
          <title id="metric-compare-title">
            3つの個別評価は、いずれも月1〜数回層で5区分中もっとも低い
          </title>
          <desc id="metric-compare-desc">
            心身サポート、雰囲気の適合、進路サポートの高評価率を、5つの通学頻度で比較した折れ線図
          </desc>

          {yTicks.map((tick) => {
            const y = yAt(tick);
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

          {/* 月1〜数回の位置を薄い縦線で示す */}
          <line
            x1={xAt(valleyIndex)}
            y1={pad.top}
            x2={xAt(valleyIndex)}
            y2={pad.top + plotH}
            stroke="#b0b0b0"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {series.map((s) => {
            const path = s.values
              .map(
                (v, i) =>
                  `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`
              )
              .join(' ');
            return (
              <g key={s.key}>
                <path
                  d={path}
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  {...('strokeDasharray' in s && s.strokeDasharray
                    ? { strokeDasharray: s.strokeDasharray }
                    : {})}
                />
                {s.values.map((v, i) => (
                  <circle
                    key={`${s.key}-${i}`}
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={i === valleyIndex ? 5 : 3.5}
                    fill={i === valleyIndex ? '#1a1a1a' : '#ffffff'}
                    stroke="#1a1a1a"
                    strokeWidth="1.75"
                  />
                ))}
              </g>
            );
          })}

          {frequencies.map((label, i) => {
            const parts = shortFreq(label);
            return (
              <g key={label}>
                <text
                  x={xAt(i)}
                  y={pad.top + plotH + 22}
                  textAnchor="middle"
                  fill="#1a1a1a"
                  fontSize="12"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {parts[0]}
                </text>
                {parts[1] ? (
                  <text
                    x={xAt(i)}
                    y={pad.top + plotH + 38}
                    textAnchor="middle"
                    fill="#1a1a1a"
                    fontSize="12"
                    fontFamily="var(--font-press-sans), sans-serif"
                  >
                    {parts[1]}
                  </text>
                ) : null}
                {i === valleyIndex ? (
                  <text
                    x={xAt(i)}
                    y={pad.top + plotH + 56}
                    textAnchor="middle"
                    fill="#595959"
                    fontSize="11"
                    fontFamily="var(--font-press-sans), sans-serif"
                  >
                    （最下位）
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
            高評価率（％）
          </text>

          {/* 凡例 */}
          <g transform={`translate(${pad.left}, ${height - 14})`}>
            {series.map((s, i) => (
              <g key={s.key} transform={`translate(${i * 145}, 0)`}>
                <line
                  x1={0}
                  y1={-4}
                  x2={22}
                  y2={-4}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  {...('strokeDasharray' in s && s.strokeDasharray
                    ? { strokeDasharray: s.strokeDasharray }
                    : {})}
                />
                <text
                  x={28}
                  y={0}
                  fill="#1a1a1a"
                  fontSize="12"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {s.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <p className="mt-4 text-sm leading-7 text-neutral-700">
        月1〜数回層では、同じ回答者でも学習面の高評価は高いままです（単位取得のしやすさ
        {monthlyLearning[0].value}％、学びの柔軟さ{monthlyLearning[1].value}％）。
        学校とのつながりや進路支援だけが、他の通学頻度より低く出ています。
      </p>

      <table className="sr-only">
        <caption>通学頻度別の個別評価・高評価率</caption>
        <thead>
          <tr>
            <th scope="col">通学頻度</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frequencies.map((freq, i) => (
            <tr key={freq}>
              <th scope="row">{freq}</th>
              {series.map((s) => (
                <td key={s.key}>{s.values[i]}％</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。縦軸は50〜90％。線種の違いは指標の区別で、優劣を表すものではありません。
      </p>
    </figure>
  );
}
