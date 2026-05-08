'use client';

interface Props {
  onStart: () => void;
}

function TypePreviewCards() {
  return (
    <div className="relative h-48 mb-2">
      {/* 左カード */}
      <div className="absolute left-3 bottom-3 w-[108px] -rotate-8 bg-white/30 backdrop-blur-sm border-2 border-white/50 rounded-2xl p-3.5 shadow-xl">
        <div className="text-3xl mb-2">🤝</div>
        <p className="text-white text-sm font-black leading-tight">サポート<br />重視タイプ</p>
        <p className="text-white/70 text-xs mt-1">先生に頼れる</p>
      </div>

      {/* 中央カード */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[124px] z-10 bg-white/40 backdrop-blur-md border-2 border-white/70 rounded-2xl p-4 shadow-2xl">
        <div className="text-4xl text-center mb-2">❓</div>
        <p className="text-white text-base font-black text-center leading-tight">
          お子さんは<br />どのタイプ？
        </p>
        <div className="mt-2.5 flex justify-center gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/70" />
          ))}
        </div>
      </div>

      {/* 右カード */}
      <div className="absolute right-3 bottom-3 w-[108px] rotate-8 bg-white/30 backdrop-blur-sm border-2 border-white/50 rounded-2xl p-3.5 shadow-xl">
        <div className="text-3xl mb-2">👥</div>
        <p className="text-white text-sm font-black leading-tight">仲間づくり<br />重視タイプ</p>
        <p className="text-white/70 text-xs mt-1">交流が好き</p>
      </div>
    </div>
  );
}

export default function StepOpening({ onStart }: Props) {
  return (
    <div className="pb-6">
      {/* Hero — 明るいブルー */}
      <div className="relative bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 rounded-3xl overflow-hidden px-5 pt-8 pb-7 mb-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-white/10 rounded-full" />

        <div className="relative">
          {/* バッジ */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="bg-white/25 text-white text-sm font-bold px-4 py-1 rounded-full">🎮 無料</span>
            <span className="bg-yellow-300 text-yellow-900 text-sm font-black px-4 py-1 rounded-full">A/B選ぶだけ</span>
          </div>

          <TypePreviewCards />

          <p className="text-white/70 text-xs text-center font-black tracking-widest mb-1 mt-1">
            通信制高校えらび診断ナビ
          </p>
          <h1 className="text-[30px] font-black text-white text-center leading-snug mb-2">
            選んで進めると<br />
            <span className="text-yellow-300 text-[34px]">お子さんに合う</span><br />
            学校へたどり着く
          </h1>
          <p className="text-white/80 text-base text-center font-medium">
            学校選びに迷っている保護者の方へ
          </p>
        </div>
      </div>

      {/* こんな方に */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-4">
        <p className="text-sm font-black text-gray-500 mb-3">こんな保護者の方向けの診断です</p>
        <div className="flex flex-col gap-2.5">
          {[
            'どの学校も似たように見えて選べない',
            '子どもに合うかどうかの判断基準がない',
            '口コミを見ても何を重視すべきか分からない',
          ].map(text => (
            <div key={text} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 font-medium">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3ステップ */}
      <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-4 mb-5">
        <p className="text-xs font-black text-sky-600 mb-3 text-center">たった3ステップ</p>
        <div className="flex items-start gap-2">
          {[
            { num: '1', text: '通学スタイルを選ぶ' },
            { num: '2', text: '7つの場面で選択' },
            { num: '3', text: 'タイプと\nおすすめ学校が判明' },
          ].map((item, i) => (
            <>
              <div key={item.num} className="flex-1 flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-sky-500 text-white text-base font-black flex items-center justify-center shadow-sm shadow-sky-200">
                  {item.num}
                </div>
                <p className="text-xs text-gray-700 font-bold leading-tight whitespace-pre-line">{item.text}</p>
              </div>
              {i < 2 && (
                <div key={`arrow-${i}`} className="mt-4 text-sky-300 text-lg font-black shrink-0">›</div>
              )}
            </>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black text-xl py-5 rounded-2xl shadow-lg shadow-rose-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
      >
        無料で診断スタート →
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        実際の在校生・卒業生の口コミデータをもとに作成
      </p>
    </div>
  );
}
