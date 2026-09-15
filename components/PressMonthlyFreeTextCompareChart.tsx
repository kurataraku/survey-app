import { MONTHLY_FREE_TEXT_COMPARE } from '@/lib/press-releases';

/** 図4: テーマごとに倍率と直接ラベル付きの棒を並べる。 */
export default function PressMonthlyFreeTextCompareChart() {
  const { rows, lowLabel, highLabel, lowN, highN } = MONTHLY_FREE_TEXT_COMPARE;

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図4. 月1〜数回の低満足層では、「改善してほしい点」に進路への言及が約2.6倍、連絡・相談への言及が約2.9倍
      </figcaption>

      <div
        className="press-chart space-y-7"
        role="img"
        aria-label="進路への言及は低満足層42.9％、高満足層16.3％で約2.6倍。連絡・相談への言及は28.6％、10.0％で約2.9倍"
      >
        {rows.map((row) => (
          <section key={row.key}>
            <div className="mb-3 flex items-start justify-between gap-4 border-b border-slate-300 pb-2">
              <h3 className="text-sm font-bold leading-6 text-slate-800 sm:text-[15px]">
                {row.label}
              </h3>
              <div className="shrink-0 border-l-2 border-[var(--press-orange)] pl-3 text-right">
                <strong className="block text-xl leading-6 text-[var(--press-orange)] sm:text-2xl">
                  {row.multipleLabel}
                </strong>
                <span className="block text-[10px] text-slate-500">
                  低満足層／高満足層
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <ThemeBar
                label={`${lowLabel}（${lowN}人）`}
                value={row.low}
                color="var(--press-orange)"
              />
              <ThemeBar
                label={`${highLabel}（${highN}人）`}
                value={row.high}
                color="var(--press-blue)"
              />
            </div>
          </section>
        ))}
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

      <p className="press-chart__note">
        対象は月1〜数回層。「改善してほしい点／合わない点」の自由記述に、当該テーマの言葉が1回でも出た人の割合です。低満足層＝総合満足度1〜3（21人）、高満足層＝4〜5（80人）。棒は0％を起点に表示。倍率は低満足層÷高満足層です。
      </p>
    </figure>
  );
}

function ThemeBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[7.75rem_1fr_3.25rem] items-center gap-2 sm:grid-cols-[9.5rem_1fr_4rem] sm:gap-3">
      <span className="text-xs font-semibold text-slate-700 sm:text-sm">
        {label}
      </span>
      <span className="press-chart__track">
        <span
          className="block h-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-right text-sm font-bold tabular-nums text-slate-800">
        {value}％
      </span>
    </div>
  );
}
