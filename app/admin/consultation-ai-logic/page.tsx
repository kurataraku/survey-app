import Link from 'next/link';
import { appPath } from '@/lib/base-path';

const logicFlow = [
  {
    title: '1. 会話文脈を整理',
    body: '最新発話だけでなく、直近の会話を見て「追加条件」「簡単に」「地域だけの絞り込み」などを元の相談に結合します。',
    examples: ['「関東」だけの追加入力でも、前の就活相談を維持', '「簡単に」は直前相談を短く再回答'],
  },
  {
    title: '2. 相談意図を判定',
    body: '学校推薦、制度説明、学び方比較、一般相談に分類します。選び方だけを聞いている場合は推薦に寄せすぎず、条件に合う学校を探している場合は候補提示へ寄せます。',
    examples: ['「選び方を知りたい」= 一般相談', '「日帰りスクーリングがある」= 学校推薦'],
  },
  {
    title: '3. 主訴・重視条件を抽出',
    body: '相談内容から、進学、不登校、学習遅れ、低頻度通学、日帰りスクーリング、イラスト・デザイン、学費、落ち着いた雰囲気などを検出します。',
    examples: ['「ネットコースで安いところ」= ネットコース・学費重視', '「ギャルが少ない」= 落ち着いた雰囲気'],
  },
  {
    title: '4. 地域・通学圏を補強',
    body: '市区町村・駅名を抽出し、学校マスターのキャンパス所在地・最寄り駅に照合します。経路APIは使わず、LLMで概ね1時間圏の主要駅・市区町村も推定して候補を広げます。',
    examples: ['「田端駅から30分以内」→ 山手線・都心側の候補語を推定', '「浪速区から」→ なんば/天王寺/大阪市中心部の候補を補強'],
  },
  {
    title: '5. RAG根拠を取得・再ランク',
    body: '口コミ、学校情報、AI要約、学費、コース、FAQを検索し、主訴に合う根拠や所在地候補の学校を優先して回答材料にします。',
    examples: ['保護者口コミを加点', '主訴キーワードに直接当たる口コミを上位化'],
  },
  {
    title: '6. 管理レビューを反映',
    body: '確認済みログのメモから、同種の相談で過去に失敗したパターンをプロンプトに渡し、同じ失敗を避けるようにしています。',
    examples: ['「学校を推薦すべきなのに一般論で返した」を避ける', '「1校だけでなく3校程度」を促す'],
  },
  {
    title: '7. 回答量・形式を調整',
    body: '「簡単に」「短く」などの指定があれば300字以内の短答に切り替えます。通常は600〜900字を目安に、質問タイプごとに見出し構成も変えます。',
    examples: ['「簡単に」→ 結論1文＋要点3つ＋確認質問1つ', '制度説明 → 学校名を出さず手続き中心'],
  },
  {
    title: '8. 回答方針を制御',
    body: '候補校は最大3校、根拠の薄い学校は弱めと明記、地域や所要時間は断定しないなどの制約をかけます。難易度が高い相談はより高性能な生成モデルを使います。',
    examples: ['通学時間は「概ね」「要確認」と表現', 'サポート校は別途在籍が必要な場合を明記'],
  },
];

const activeRules = [
  {
    category: '意図判定',
    rules: [
      '「おすすめ」「探しています」「どこ」「通える」「行きやすい」は学校推薦に寄せる',
      '「選び方を知りたい」「流れが知りたい」「就職率」は一般相談に残す',
      '単独の学校名評価は、その学校についての説明・評価として扱う',
    ],
  },
  {
    category: '主訴判定',
    rules: [
      '大学受験・進学、就職・キャリア、不登校・人間関係、学習遅れ、朝起きられないを検出',
      '年1-3回などの低頻度通学、日帰りスクーリング、ネットコース・学費重視を検出',
      'イラスト・デザイン、落ち着いた雰囲気などの具体的な希望も検出',
    ],
  },
  {
    category: '地域・通学圏',
    rules: [
      '任意の「市・区・町・村・駅」を抽出してキャンパス所在地・最寄り駅と照合',
      'LLMで概ね1時間圏の主要駅・市区町村を推定し、候補校検索語に追加',
      '正確な経路検索ではないため、徒歩・乗換込みの所要時間は断定しない',
    ],
  },
  {
    category: '回答量・短答',
    rules: [
      '「簡単に」「短く」「要約」「一言」「3行」「箇条書きだけ」を短答指定として検出',
      '短答指定時は直前の相談文脈を維持したまま、Markdown見出しなし・300字以内で再回答',
      '短答指定時は「結論1文＋候補または要点3つまで＋確認質問1つ」の構成',
      '短答指定がない通常回答は600〜900字程度を目安（以前の800〜1200字から短縮）',
    ],
  },
  {
    category: '質問タイプ別の出力形式',
    rules: [
      '制度・手続き説明: 学校名を出さず、## 結論 / 退学後の入学と転校扱いの違い / 先に確認すること / 学校へ問い合わせる時の聞き方',
      '学び方比較: 学校名・候補校を出さず、オンライン中心 vs 通学型の選び方を説明',
      '一般相談: 候補校を無理に出さず、## 考え方 / 選び方のポイント / 確認ポイント',
      '2校以上の比較: 新しい候補を追加せず、## 比較の結論 / 学校ごとの向き不向き / 選ぶ時の確認ポイント',
      '学校推薦: ## 候補校見出し / ## 選んだ理由 / ## 確認ポイント。各校名は ### 見出し',
    ],
  },
  {
    category: '候補校提示',
    rules: [
      '学校推薦では原則2-3校、最大3校まで',
      '所在地根拠と口コミ根拠を分けて説明',
      '公立通信制・私立通信制・サポート校の区分を分かる範囲で明記',
      '地域未指定の推薦では「参考候補」として提示し、通学可否は別途確認が必要と明記',
    ],
  },
  {
    category: '会話文脈の引き継ぎ',
    rules: [
      '「関東」「それなら」「追加で」などの追加入力は直前の相談に条件を結合',
      '短答指定だけでなく、地域絞り込み・条件追加も元の相談内容を維持',
      '直近8ターンの会話をプロンプトに渡し、文脈を失わない',
    ],
  },
  {
    category: '根拠・レビュー活用',
    rules: [
      'RAG文書のdoc参照を回答内に [doc_n] 形式で付ける',
      '確認済みログの管理メモを同種相談の内部ガイドとして利用',
      '「落ち着いた雰囲気」主訴では、アンケート集計から落ち着き比率の高い学校を補助情報として渡す',
      '「ギャルが少ない」などは見た目で断定せず、在校生の雰囲気回答として扱う',
    ],
  },
  {
    category: '文体・表現',
    rules: [
      '冒頭は「結論:」ラベルではなく「まず結論からお伝えすると、」のような自然な文で始める',
      '確認ポイントなどの列挙は必ず Markdown の「- 」箇条書き',
      '保護者に寄り添う丁寧で温かい語り口。断定・過剰保証は避ける',
    ],
  },
];

const improvementHistory = [
  {
    date: '2026-06-24',
    title: '相談AIモニタリングとレビュー運用を開始',
    changes: [
      '相談ログ、回答、RAG根拠、候補校、管理者メモを保存',
      '確認済みステータスとメモ欄を精度改善サイクルに利用',
    ],
  },
  {
    date: '2026-06-24',
    title: '地域指定・低頻度通学の改善',
    changes: [
      '多摩地区・立川近辺などの地域指定を学校マスターのキャンパス所在地で補強',
      '年1-3回通学、集中スクーリング、オンライン中心の相談を専用主訴として扱う',
      '候補が1校だけに偏らないよう、原則3校程度を提示する方針を追加',
    ],
  },
  {
    date: '2026-06-24',
    title: '回答量の調整ロジックを追加',
    changes: [
      '「簡単に」などの短答指定を検出し、300字以内・見出しなしの短答モードに切り替え',
      '短答指定時も直前の相談文脈を維持して再回答',
      '通常回答の目安を600〜900字に調整（以前より短く）',
    ],
  },
  {
    date: '2026-07-05',
    title: '推薦すべき相談の取りこぼしを改善',
    changes: [
      '「日帰りスクーリングがある」「イラストを学びたい」「ネットコースで安いところ」を学校推薦へ寄せる',
      '「選び方を知りたい」は一般相談として残す判定を追加',
      '就職・キャリア支援、イラスト・デザイン、学費、落ち着いた雰囲気の主訴を追加',
    ],
  },
  {
    date: '2026-07-05',
    title: '質問タイプ別の出力形式を細分化',
    changes: [
      '制度説明・学び方比較・一般相談・複数校比較で、それぞれ専用の見出し構成を指定',
      '学び方比較では学校名を出さない方針を追加',
      '落ち着いた雰囲気の主訴では、アンケート集計から補助候補を生成',
    ],
  },
  {
    date: '2026-07-07',
    title: '汎用的な地域・駅名検索を追加',
    changes: [
      '任意の市区町村・駅名を抽出し、campus_locations と nearest_stations に照合',
      '浪速区・田端駅などの個別対応だけに依存しない構成へ変更',
      '候補の通学時間は断定せず、最寄り駅・乗換・徒歩込みで確認する注意を追加',
    ],
  },
  {
    date: '2026-07-07',
    title: 'LLMによる概ね1時間圏の通学候補補強を追加',
    changes: [
      '出発地から電車・バスで概ね1時間以内に候補になりやすい駅・市区町村をLLMで推定',
      '推定キーワードを学校マスター検索に混ぜ、候補校の質を改善',
      '経路APIなしの目安であることを内部プロンプトと回答方針に明記',
    ],
  },
];

const reviewLoop = [
  '管理画面の相談ログで回答を確認する',
  '良い回答・悪い回答を確認済みにし、メモへ改善内容を書く',
  '同種相談で参照される管理レビューとしてプロンプトに反映される',
  '必要に応じて意図判定・RAG検索語・回答方針をコード側にも追加する',
  '改善後の回答を再度ログで確認し、メモを蓄積する',
];

export default function ConsultationAiLogicPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={appPath('/admin')} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← 管理画面に戻る
          </Link>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">相談AIロジック・改善履歴</h1>
              <p className="mt-2 text-gray-600">
                相談AIがどのロジックで回答品質を作っているか、いつ何を改善したかを確認できます。
              </p>
            </div>
            <Link
              href={appPath('/admin/consultation-chats')}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              相談ログを見る
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-blue-950">このページの目的</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900">
            相談AIは、単にLLMへ質問を投げているのではなく、会話文脈、相談意図、主訴、地域、RAG根拠、管理レビューを組み合わせて回答しています。
            このページは、人間が改善の方向性を追えるように、その判断ロジックと改善履歴を管理画面上で可視化するためのものです。
          </p>
          <p className="mt-3 text-sm leading-6 text-blue-900">
            実装の正本は <code className="rounded bg-blue-100 px-1">app/api/chat/route.ts</code> です。
            このページは運用向けの要約であり、コード変更時に手動で更新する必要があります。
            すべての分岐・正規表現・プロンプト全文を1画面で網羅するものではありません。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">現在の回答生成フロー</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {logicFlow.map((item) => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-700">{item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.examples.map((example) => (
                    <span key={example} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">現在有効な主なルール</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {activeRules.map((group) => (
              <div key={group.category} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{group.category}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                  {group.rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">改善履歴</h2>
          <div className="space-y-4">
            {improvementHistory.map((item) => (
              <div key={`${item.date}-${item.title}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    {item.date}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                  {item.changes.map((change) => (
                    <li key={change} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">改善サイクル</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              {reviewLoop.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold text-amber-950">注意点</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-900">
              <li>経路APIは使っていないため、通学時間は正確な保証ではなく「候補を広げる目安」です。</li>
              <li>管理レビューは内部ガイドとして使い、公開回答でメモの存在は説明しません。</li>
              <li>RAG根拠が薄い学校は「根拠は弱め」と明記する方針です。</li>
              <li>改善履歴はコード変更に合わせてこのページも更新してください。</li>
              <li>回答量は短答指定で300字以内、通常は600〜900字が目安です。短答指定の検出語は「簡単に」「短く」「要約」「一言」「3行」「箇条書きだけ」です。</li>
              <li>質問タイプによっては学校名を出さない・見出し構成を固定するなど、出力形式が大きく変わります。</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
