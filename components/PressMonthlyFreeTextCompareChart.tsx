import { MONTHLY_FREE_TEXT_COMPARE } from '@/lib/press-releases';

/**
 * 図4: 月1〜数回層の改善点テーマ言及率。
 * 低満足層が高満足層の約2.6倍・約2.9倍であることを棒の差と倍率ラベルで示す。
 */
export default function PressMonthlyFreeTextCompareChart() {
  const { rows, lowLabel, highLabel, lowN, highN } = MONTHLY_FREE_TEXT_COMPARE;
  const width = 640;
  const blockH = 110;
  const pad = { top: 40, right: 108, bottom: 48, left: 118 };
  const height = pad.top + rows.length * blockH + pad.bottom;
  const plotW = width - pad.left - pad.right;
  const xMax = 50;
  const xTicks = [0, 10, 20, 30, 40, 50];
  const barH = 18;
  const gap = 8;

  const xAt = (v: number) => pad.left + (v / xMax) * plotW;

  return (
    <figure className="mt-6">
      <figcaption className="mb-3 text-sm font-semibold leading-6 text-neutral-900">
        図4. 月1〜数回の低満足層では、「改善してほしい点」に進路への言及が約2.6倍、連絡・相談への言及が約2.9倍
      </figcaption>

      <div className="border border-neutral-800 bg-white px-2 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby="freetext-compare-title freetext-compare-desc"
        >
          <title id="freetext-compare-title">
            月1〜数回層の低満足層は、改善してほしい点で進路・連絡への言及が高満足層より約2.6倍・約2.9倍多い
          </title>
          <desc id="freetext-compare-desc">
            進路は低満足層42.9％対高満足層16.3％（約2.6倍）。連絡・相談・フォローは28.6％対10.0％（約2.9倍）
          </desc>

          {/* 凡例 */}
          <g transform={`translate(${pad.left}, 18)`}>
            <rect
              x={0}
              y={-7}
              width={18}
              height={12}
              fill="#1a1a1a"
            />
            <text
              x={24}
              y={3}
              fill="#1a1a1a"
              fontSize="12"
              fontFamily="var(--font-press-sans), sans-serif"
            >
              {lowLabel}（{lowN}人）
            </text>
            <rect
              x={148}
              y={-7}
              width={18}
              height={12}
              fill="#ffffff"
              stroke="#1a1a1a"
              strokeWidth="1.5"
            />
            <text
              x={172}
              y={3}
              fill="#1a1a1a"
              fontSize="12"
              fontFamily="var(--font-press-sans), sans-serif"
            >
              {highLabel}（{highN}人）
            </text>
          </g>

          {xTicks.map((tick) => {
            const x = xAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={x}
                  y1={pad.top - 4}
                  x2={x}
                  y2={pad.top + rows.length * blockH - 18}
                  stroke="#e8e8e8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={pad.top + rows.length * blockH}
                  textAnchor="middle"
                  fill="#595959"
                  fontSize="11"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={pad.left}
            y1={pad.top + rows.length * blockH - 18}
            x2={width - pad.right}
            y2={pad.top + rows.length * blockH - 18}
            stroke="#1a1a1a"
            strokeWidth="1.25"
          />

          {rows.map((row, i) => {
            const blockTop = pad.top + i * blockH;
            const yLow = blockTop + 28;
            const yHigh = yLow + barH + gap;
            const midY = (yLow + yHigh + barH) / 2;
            const lowW = Math.max((row.low / xMax) * plotW, 2);
            const highW = Math.max((row.high / xMax) * plotW, 2);

            return (
              <g key={row.key}>
                <text
                  x={pad.left - 12}
                  y={midY - 6}
                  textAnchor="end"
                  fill="#1a1a1a"
                  fontSize="13"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {row.shortLabel[0]}
                </text>
                <text
                  x={pad.left - 12}
                  y={midY + 10}
                  textAnchor="end"
                  fill="#1a1a1a"
                  fontSize="13"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {row.shortLabel[1]}
                </text>

                <rect
                  x={pad.left}
                  y={yLow}
                  width={lowW}
                  height={barH}
                  fill="#1a1a1a"
                />
                <text
                  x={pad.left + lowW + 8}
                  y={yLow + 14}
                  fill="#1a1a1a"
                  fontSize="13"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {row.low}％
                </text>

                <rect
                  x={pad.left}
                  y={yHigh}
                  width={highW}
                  height={barH}
                  fill="#ffffff"
                  stroke="#1a1a1a"
                  strokeWidth="1.5"
                />
                <text
                  x={pad.left + highW + 8}
                  y={yHigh + 14}
                  fill="#1a1a1a"
                  fontSize="13"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {row.high}％
                </text>

                {/* 倍率ラベル */}
                <text
                  x={width - pad.right + 12}
                  y={midY + 1}
                  fill="#1a1a1a"
                  fontSize="16"
                  fontWeight="700"
                  fontFamily="var(--font-press-serif), serif"
                >
                  {row.multipleLabel}
                </text>
                <text
                  x={width - pad.right + 12}
                  y={midY + 16}
                  fill="#595959"
                  fontSize="10"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  （低満足／高満足）
                </text>
              </g>
            );
          })}

          <text
            x={pad.left + plotW / 2}
            y={height - 8}
            textAnchor="middle"
            fill="#595959"
            fontSize="11"
            fontFamily="var(--font-press-sans), sans-serif"
          >
            言及した人の割合（％）
          </text>
        </svg>
      </div>

      <table className="sr-only">
        <caption>
          月1〜数回層の改善してほしい点におけるテーマ言及率
        </caption>
        <thead>
          <tr>
            <th scope="col">テーマ</th>
            <th scope="col">
              {lowLabel}（{lowN}人）
            </th>
            <th scope="col">
              {highLabel}（{highN}人）
            </th>
            <th scope="col">倍率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.low}％</td>
              <td>{row.high}％</td>
              <td>{row.multipleLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        対象は月1〜数回層。「改善してほしい点／合わない点」の自由記述に、当該テーマの言葉が1回でも出た人の割合です。低満足層＝総合満足度1〜3（21人）、高満足層＝4〜5（80人）。倍率は低満足層÷高満足層です。
      </p>
    </figure>
  );
}
