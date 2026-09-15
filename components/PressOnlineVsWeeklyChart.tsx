import { ONLINE_VS_WEEKLY_COMPARE } from '@/lib/press-releases';

/**
 * 図3: ほぼオンライン vs 週5通学のダンベル図。
 * 総合は同率、サポート／進路／学費で差が開くことを示す。
 */
export default function PressOnlineVsWeeklyChart() {
  const { groups, rows } = ONLINE_VS_WEEKLY_COMPARE;
  const width = 640;
  const rowH = 56;
  const pad = { top: 36, right: 72, bottom: 52, left: 148 };
  const height = pad.top + rows.length * rowH + pad.bottom;
  const plotW = width - pad.left - pad.right;
  const xMax = 100;
  const xTicks = [0, 25, 50, 75, 100];

  const xAt = (v: number) => pad.left + (v / xMax) * plotW;
  const yAt = (i: number) => pad.top + i * rowH + rowH / 2;

  return (
    <figure className="mt-6">
      <figcaption className="mb-3 text-sm font-semibold text-neutral-900">
        図3. ほぼオンライン層と週5通学層の比較（単位：％）
      </figcaption>

      <div className="border border-neutral-800 bg-white px-2 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby="online-weekly-title online-weekly-desc"
        >
          <title id="online-weekly-title">
            総合満足度は同率94.3％だが、サポート・進路・学費の評価は両層で異なる
          </title>
          <desc id="online-weekly-desc">
            白丸がほぼオンライン、黒丸が週5通学。総合は重なり、心身サポートは60.3％対87.4％、進路は62.0％対81.6％、学費低評価は7.9％対20.0％
          </desc>

          {/* 凡例 */}
          <g transform={`translate(${pad.left}, 18)`}>
            <circle
              cx={0}
              cy={0}
              r={5.5}
              fill="#ffffff"
              stroke="#1a1a1a"
              strokeWidth="1.75"
            />
            <text
              x={12}
              y={4}
              fill="#1a1a1a"
              fontSize="12"
              fontFamily="var(--font-press-sans), sans-serif"
            >
              {groups[0].short}
            </text>
            <circle cx={128} cy={0} r={5.5} fill="#1a1a1a" />
            <text
              x={140}
              y={4}
              fill="#1a1a1a"
              fontSize="12"
              fontFamily="var(--font-press-sans), sans-serif"
            >
              {groups[1].short}
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
                  y2={pad.top + rows.length * rowH - 8}
                  stroke="#e8e8e8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={pad.top + rows.length * rowH + 14}
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
            y1={pad.top + rows.length * rowH - 8}
            x2={width - pad.right}
            y2={pad.top + rows.length * rowH - 8}
            stroke="#1a1a1a"
            strokeWidth="1.25"
          />

          {rows.map((row, i) => {
            const y = yAt(i);
            const xOnline = xAt(row.online);
            const xWeekly = xAt(row.weekly);
            const same = row.online === row.weekly;
            const left = Math.min(xOnline, xWeekly);
            const right = Math.max(xOnline, xWeekly);

            return (
              <g key={row.key}>
                <text
                  x={pad.left - 12}
                  y={y - (row.note ? 4 : 0)}
                  textAnchor="end"
                  fill="#1a1a1a"
                  fontSize="13"
                  fontFamily="var(--font-press-sans), sans-serif"
                >
                  {row.label}
                </text>
                {row.note ? (
                  <text
                    x={pad.left - 12}
                    y={y + 14}
                    textAnchor="end"
                    fill="#595959"
                    fontSize="11"
                    fontFamily="var(--font-press-sans), sans-serif"
                  >
                    （{row.note}）
                  </text>
                ) : null}

                {!same ? (
                  <line
                    x1={left}
                    y1={y}
                    x2={right}
                    y2={y}
                    stroke="#1a1a1a"
                    strokeWidth="1.5"
                  />
                ) : null}

                {/* ほぼオンライン（白丸）を先に、週5（黒丸）を重ねる */}
                <circle
                  cx={xOnline}
                  cy={y}
                  r={same ? 7 : 6}
                  fill="#ffffff"
                  stroke="#1a1a1a"
                  strokeWidth="1.75"
                />
                {!same ? (
                  <circle cx={xWeekly} cy={y} r={6} fill="#1a1a1a" />
                ) : (
                  <circle cx={xWeekly} cy={y} r={3.25} fill="#1a1a1a" />
                )}

                <text
                  x={same ? xOnline + 14 : right + 10}
                  y={y + 4}
                  fill="#1a1a1a"
                  fontSize="12"
                  fontFamily="var(--font-press-sans), sans-serif"
                  fontVariantNumeric="tabular-nums"
                >
                  {same
                    ? `${row.online}％`
                    : `${row.online}／${row.weekly}`}
                </text>
              </g>
            );
          })}

          <text
            x={pad.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            fill="#595959"
            fontSize="11"
            fontFamily="var(--font-press-sans), sans-serif"
          >
            割合（％）
          </text>
        </svg>
      </div>

      <table className="sr-only">
        <caption>ほぼオンライン層と週5通学層の比較</caption>
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">{groups[0].label}</th>
            <th scope="col">{groups[1].label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>
                {row.online}％（{row.onlineCount}）
              </td>
              <td>
                {row.weekly}％（{row.weeklyCount}）
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。白丸＝ほぼオンライン、黒丸＝週5通学。学費のみ「納得感1〜2（低評価）」の割合で、他項目とは見方が逆になります。数値ラベルは「ほぼオンライン／週5」の順です。
      </p>
    </figure>
  );
}
