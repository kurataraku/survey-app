import { ONLINE_VS_WEEKLY_COMPARE } from '@/lib/press-releases';

/** 図3: 2群を直接ラベル付きの棒で比較し、学費は評価方向が逆だと分離して示す。 */
export default function PressOnlineVsWeeklyChart() {
  const { groups, rows } = ONLINE_VS_WEEKLY_COMPARE;

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図3. ほぼオンライン層と週5通学層の比較（単位：％）
      </figcaption>

      <div
        className="press-chart space-y-7"
        role="img"
        aria-label="高満足率は両群94.3％で同率。心身サポート高評価はほぼオンライン60.3％、週5通学87.4％。進路サポート高評価は62.0％、81.6％。学費の低評価は7.9％、20.0％"
      >
        {rows.map((row, index) => {
          const isTuition = row.key === 'tuition';
          const note = 'note' in row ? row.note : undefined;
          return (
            <section
              key={row.key}
              className={
                isTuition
                  ? 'border-t-2 border-slate-300 bg-slate-50 px-3 pt-5 pb-3'
                  : ''
              }
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-bold text-slate-800 sm:text-[15px]">
                  {row.label}
                </h3>
                {note ? (
                  <span
                    className={`text-xs font-semibold ${
                      isTuition
                        ? 'text-[var(--press-orange)]'
                        : 'text-[var(--press-navy)]'
                    }`}
                  >
                    {note}
                  </span>
                ) : null}
              </div>
              {isTuition ? (
                <p className="!mt-0 !mb-3 text-xs font-medium text-slate-600">
                  ※この項目のみ「低評価」の割合。数値が低いほど、学費に強い不満を持つ人が少ない
                </p>
              ) : null}
              <div className="space-y-3">
                <ComparisonBar
                  label={groups[0].short}
                  value={row.online}
                  count={row.onlineCount}
                  color="var(--press-blue)"
                />
                <ComparisonBar
                  label={groups[1].short}
                  value={row.weekly}
                  count={row.weeklyCount}
                  color="var(--press-gold)"
                />
              </div>
              {index === 0 ? (
                <p className="!mt-2 text-xs font-bold text-[var(--press-navy)]">
                  両群とも94.3％
                </p>
              ) : null}
            </section>
          );
        })}
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

      <p className="press-chart__note">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。棒は0％を起点に表示。高満足層＝総合満足度4〜5。個別項目の高評価＝各項目4〜5。学費の低評価のみ1〜2の割合です。
      </p>
    </figure>
  );
}

function ComparisonBar({
  label,
  value,
  count,
  color,
}: {
  label: string;
  value: number;
  count: string;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 sm:grid-cols-[8rem_1fr]">
      <span className="text-xs font-semibold text-slate-700 sm:text-sm">
        {label}
      </span>
      <span className="text-right text-sm font-bold tabular-nums text-slate-800">
        {value}％
        <span className="ml-1 text-[10px] font-normal text-slate-500 sm:text-xs">
          （{count}）
        </span>
      </span>
      <span className="col-start-2 press-chart__track">
        <span
          className="block h-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </span>
    </div>
  );
}
