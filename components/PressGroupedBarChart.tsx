type BarSeries = {
  key: string;
  label: string;
  color: string;
};

type BarCategory = {
  label: string;
  values: Record<string, number>;
  annotation?: string;
  colors?: Record<string, string>;
};

type PressGroupedBarChartProps = {
  ariaLabel: string;
  series: readonly BarSeries[];
  categories: readonly BarCategory[];
  max?: number;
  tickStep?: number;
  labelWidth?: string;
  showLegend?: boolean;
};

/**
 * 一般的な調査レポート形式の集合横棒グラフ。
 * 上部目盛・縦グリッド・棒・値・下部凡例だけで構成する。
 */
export default function PressGroupedBarChart({
  ariaLabel,
  series,
  categories,
  max = 100,
  tickStep = 20,
  labelWidth = '11rem',
  showLegend = true,
}: PressGroupedBarChartProps) {
  const ticks = Array.from(
    { length: Math.floor(max / tickStep) + 1 },
    (_, index) => index * tickStep
  );
  const columns = `${labelWidth} minmax(20rem, 1fr) 4rem`;

  return (
    <div className="overflow-x-auto bg-white px-2 py-4 sm:px-4">
      <div
        className="min-w-[39rem]"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="mb-3 grid items-end gap-x-3"
          style={{ gridTemplateColumns: columns }}
          aria-hidden="true"
        >
          <span />
          <div className="relative h-7 border-b border-slate-300">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute bottom-1 -translate-x-1/2 text-xs font-semibold text-slate-700"
                style={{ left: `${(tick / max) * 100}%` }}
              >
                {tick}%
              </span>
            ))}
          </div>
          <span />
        </div>

        <div className="space-y-7">
          {categories.map((category) => (
            <div
              key={category.label}
              className="grid items-center gap-x-3 gap-y-2"
              style={{
                gridTemplateColumns: columns,
                gridTemplateRows: `repeat(${series.length}, minmax(1.25rem, auto))`,
              }}
            >
              <div
                className="pr-2 text-right text-sm font-bold leading-6 text-slate-800"
                style={{ gridRow: `1 / span ${series.length}` }}
              >
                <span className="block">{category.label}</span>
                {category.annotation ? (
                  <span className="mt-1 block text-xs font-bold text-[var(--press-orange)]">
                    {category.annotation}
                  </span>
                ) : null}
              </div>

              {series.map((item, index) => {
                const value = category.values[item.key];
                return (
                  <BarRow
                    key={item.key}
                    value={value}
                    max={max}
                    color={category.colors?.[item.key] ?? item.color}
                    row={index + 1}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {showLegend && series.length > 1 ? (
          <div
            className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-2 border-t border-slate-300 pt-4"
            aria-hidden="true"
          >
            {series.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
              >
                <span
                  className="h-3 w-4"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BarRow({
  value,
  max,
  color,
  row,
}: {
  value: number;
  max: number;
  color: string;
  row: number;
}) {
  return (
    <>
      <div
        className="h-5 border-x border-slate-200"
        style={{
          gridColumn: 2,
          gridRow: row,
          backgroundImage:
            'linear-gradient(to right, #d7dee5 1px, transparent 1px)',
          backgroundSize: '20% 100%',
        }}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.min((value / max) * 100, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="text-sm font-bold tabular-nums text-slate-800"
        style={{ gridColumn: 3, gridRow: row }}
      >
        {value.toFixed(1)}
      </span>
    </>
  );
}
