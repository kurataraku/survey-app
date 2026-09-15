import { ATTENDANCE_METRIC_COMPARE } from '@/lib/press-releases';

/** 図2: 指標ごとの横棒に分け、凡例なしで5通学頻度を比較する。 */
export default function PressMonthlyMetricCompareChart() {
  const { frequencies, series, monthlyLearning } = ATTENDANCE_METRIC_COMPARE;
  const valleyIndex = 1;

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図2. 通学頻度別の個別評価・高評価率（各項目4〜5／心身サポート／雰囲気／進路）
      </figcaption>

      <div
        className="press-chart space-y-7"
        role="img"
        aria-label="心身サポート、雰囲気の適合、進路サポートはいずれも月1〜数回層が5区分中で最低"
      >
        {series.map((metric) => (
          <section key={metric.key} aria-label={metric.label}>
            <h3 className="mb-3 border-b border-slate-300 pb-2 text-sm font-bold text-[var(--press-navy)] sm:text-[15px]">
              {metric.label}
              <span className="ml-2 font-normal text-slate-500">高評価率</span>
            </h3>
            <div className="space-y-2.5">
              {frequencies.map((frequency, index) => {
                const value = metric.values[index];
                const isLowest = index === valleyIndex;
                return (
                  <div
                    key={frequency}
                    className={`grid grid-cols-[5.75rem_1fr_3.25rem] items-center gap-2 px-1 py-1 sm:grid-cols-[8rem_1fr_4rem] sm:gap-3 ${
                      isLowest ? 'bg-[var(--press-orange-soft)]' : ''
                    }`}
                  >
                    <span
                      className={`text-xs leading-4 sm:text-sm ${
                        isLowest
                          ? 'font-bold text-[var(--press-orange)]'
                          : 'font-medium text-slate-700'
                      }`}
                    >
                      {frequency}
                    </span>
                    <span className="press-chart__track">
                      <span
                        className="block h-full"
                        style={{
                          width: `${value}%`,
                          backgroundColor: isLowest
                            ? 'var(--press-orange)'
                            : 'var(--press-blue)',
                        }}
                      />
                    </span>
                    <span
                      className={`text-right text-sm tabular-nums ${
                        isLowest
                          ? 'font-bold text-[var(--press-orange)]'
                          : 'font-semibold text-slate-700'
                      }`}
                    >
                      {value}％
                    </span>
                    {isLowest ? (
                      <span className="col-start-2 col-end-4 -mt-1 text-[11px] font-bold text-[var(--press-orange)]">
                        5区分中で最低
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-4 border-l-4 border-[var(--press-blue)] bg-[var(--press-blue-soft)] px-4 py-3 text-sm leading-7 text-slate-700">
        <strong className="text-[var(--press-navy)]">一方、学習面は8割超</strong>
        <span className="block sm:inline">
          <span className="hidden sm:inline">：</span>
          単位取得のしやすさ {monthlyLearning[0].value}％、学びの柔軟さ{' '}
          {monthlyLearning[1].value}％
        </span>
      </div>

      <table className="sr-only">
        <caption>通学頻度別の個別評価・高評価率</caption>
        <thead>
          <tr>
            <th scope="col">通学頻度</th>
            {series.map((metric) => (
              <th key={metric.key} scope="col">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frequencies.map((frequency, index) => (
            <tr key={frequency}>
              <th scope="row">{frequency}</th>
              {series.map((metric) => (
                <td key={metric.key}>{metric.values[index]}％</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="press-chart__note">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。棒は0％を起点に表示。ここでの高評価率は個別項目（4〜5）であり、総合満足度の高満足率とは別指標です。
      </p>
    </figure>
  );
}
