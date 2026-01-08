import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '通信制高校リアルレビュー｜利用規約',
  description: '通信制高校リアルレビューの利用規約ページです。',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">利用規約</h1>
          
          <div className="text-gray-700 leading-relaxed space-y-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">通信制高校リアルレビュー 利用規約</h2>
              
              <p className="text-base sm:text-lg">
                本利用規約（以下「本規約」）は、株式会社キャリアエッセンス（以下「当社」）が運営する「通信制高校リアルレビュー」（以下「本サービス」）の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスを利用するものとします。
              </p>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第1条（適用）</h2>
                <ol className="list-decimal list-outside ml-6 space-y-2">
                  <li>本規約は、本サービスの利用に関する当社と利用者との間の一切の関係に適用されます。</li>
                  <li>当社が本サービス上で掲載するルール、ガイド、注意事項等は、本規約の一部を構成します。</li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第2条（定義）</h2>
                <p>本規約において、次の用語は以下の意味を有します。</p>
                <ul className="list-disc list-outside ml-6 space-y-2">
                  <li>「投稿」：口コミ、評価、コメント、アンケート回答、画像等、利用者が本サービスに送信する一切の情報</li>
                  <li>「コンテンツ」：本サービス上に掲載される文章、画像、データ等の一切</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第3条（利用環境）</h2>
                <p>利用者は、自己の費用と責任において、本サービス利用に必要な端末・通信環境等を整備します。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第4条（投稿内容の注意）</h2>
                <ol className="list-decimal list-outside ml-6 space-y-4">
                  <li>利用者は、投稿にあたり、事実に基づき、可能な限り具体的かつ誠実な内容を記載するよう努めるものとします。</li>
                  <li>
                    利用者は、以下に該当する情報を投稿してはなりません。
                    <ul className="list-disc list-outside ml-6 mt-2 space-y-1">
                      <li>個人が特定され得る情報（氏名、住所、電話番号、メールアドレス、SNSアカウント、顔写真、学籍情報、所属クラス、特定できる出来事など）</li>
                      <li>教職員・生徒等の特定個人への攻撃、誹謗中傷、脅迫、差別、名誉毀損、プライバシー侵害</li>
                      <li>虚偽・誤認を招く内容、なりすまし、ステルスマーケティング等</li>
                      <li>当社または第三者の権利（著作権、商標権等）を侵害する内容</li>
                      <li>法令、公序良俗に反する内容</li>
                      <li>広告、宣伝、勧誘、アフィリエイト目的の内容</li>
                      <li>その他当社が不適切と判断する内容</li>
                    </ul>
                  </li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第5条（投稿の掲載・編集・非掲載）</h2>
                <ol className="list-decimal list-outside ml-6 space-y-2">
                  <li>当社は、利用者の投稿を、当社の裁量により、掲載・非掲載・表示順・表示箇所の変更を行うことができます。</li>
                  <li>当社は、投稿の趣旨を変えない範囲で、誤字脱字の修正、表現の調整、個人情報・攻撃的表現のマスキング等の編集を行う場合があります。</li>
                  <li>当社は、理由の開示義務を負うことなく、投稿の削除・非掲載等を行うことができます。</li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第6条（投稿データの権利）</h2>
                <ol className="list-decimal list-outside ml-6 space-y-2">
                  <li>投稿の著作権は利用者に留保されます。</li>
                  <li>利用者は当社に対し、投稿を本サービスの運営・品質向上・分析・統計化・告知（SNS等含む）・プロモーション目的で、無償・非独占的・地域/期間の定めなく利用（複製、公衆送信、翻案、要約、抜粋、編集、第三者への再許諾を含む）する権利を許諾します。</li>
                  <li>利用者は、投稿に関して著作者人格権を行使しないものとします（ただし当社は第5条の範囲を超えて投稿の趣旨を著しく変更しないよう配慮します）。</li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第7条（口コミ・評価の性質と免責）</h2>
                <ol className="list-decimal list-outside ml-6 space-y-2">
                  <li>本サービス上の情報は、利用者の主観的体験・意見を含み、正確性・完全性・最新性を当社が保証するものではありません。</li>
                  <li>本サービスの情報を利用して生じた進学・転学等の意思決定や損害について、当社は責任を負いません（当社に故意または重過失がある場合を除きます）。</li>
                  <li>当社は、学校その他第三者との間で生じた紛争について責任を負いません。</li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第8条（サービスの変更・停止）</h2>
                <p>当社は、利用者に事前に通知することなく、本サービスの内容変更、提供の中断・停止・終了を行うことができます。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第9条（禁止行為）</h2>
                <p>利用者は、以下の行為をしてはなりません。</p>
                <ul className="list-disc list-outside ml-6 space-y-1">
                  <li>本規約に違反する行為</li>
                  <li>本サービスの運営を妨害する行為（過度なアクセス、スクレイピング等を含む）</li>
                  <li>不正アクセス、改ざん、リバースエンジニアリング等</li>
                  <li>その他当社が不適切と判断する行為</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第10条（個人情報等の取扱い）</h2>
                <p>当社は、利用者の個人情報を、別途定めるプライバシーポリシーに従って取り扱います。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第11条（規約の変更）</h2>
                <p>当社は、本規約を変更できるものとし、変更後の規約は本サービス上への掲示等により効力を生じます。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">第12条（準拠法・管轄）</h2>
                <p>本規約は日本法を準拠法とし、本サービスに関連して生じる紛争は、当社本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
              </section>

              <div className="mt-12 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-600">【制定日】2026年1月8日</p>
                <p className="text-sm text-gray-600">【運営者】株式会社キャリアエッセンス</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
