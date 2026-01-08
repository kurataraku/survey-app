import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '通信制高校リアルレビュー｜プライバシーポリシー',
  description: '通信制高校リアルレビューのプライバシーポリシーページです。',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>
          
          <div className="text-gray-700 leading-relaxed space-y-8">
            <div className="space-y-6">
              <p className="text-base sm:text-lg">
                株式会社キャリアエッセンス（以下「当社」）は、当社が運営する「通信制高校リアルレビュー」（以下「本サービス」）における利用者情報を、以下のとおり取り扱います。
              </p>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. 取得する情報</h2>
                <p>当社は、本サービスの提供にあたり、以下の情報を取得する場合があります。</p>
                <ul className="list-disc list-outside ml-6 space-y-2">
                  <li>利用者が入力する情報：口コミ投稿内容、アンケート回答、メールアドレス（任意）、その他任意入力項目</li>
                  <li>端末・ログ情報：IPアドレス、ブラウザ情報、アクセス日時、閲覧ページ、Cookie等</li>
                  <li>お問い合わせ情報：氏名（任意）、連絡先、問い合わせ内容 等</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. 利用目的</h2>
                <p>当社は、取得した情報を以下の目的で利用します。</p>
                <ul className="list-disc list-outside ml-6 space-y-2">
                  <li>本サービスの提供・運営（投稿の表示、検索、問い合わせ対応等）</li>
                  <li>投稿内容の審査、品質向上、不正利用防止</li>
                  <li>投稿・回答の集計、統計化、分析（個人が特定されない形での公表を含む）</li>
                  <li>本サービスの改善・新機能開発</li>
                  <li>重要なお知らせ等の連絡（メールアドレスを提供いただいた場合）</li>
                  <li>法令遵守、紛争対応、権利侵害への対応</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. 第三者提供</h2>
                <p>当社は、法令に基づく場合等を除き、本人の同意なく個人情報を第三者に提供しません。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. 委託</h2>
                <p>当社は、本サービス運営のため、クラウドサービス（例：データベース、ホスティング、分析ツール等）に個人情報の取扱いを委託する場合があります。この場合、委託先の選定・監督を適切に行います。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Cookie等の利用</h2>
                <p>当社は、利便性向上や利用状況の把握のためCookie等を使用する場合があります。利用者はブラウザ設定によりCookieを無効にできますが、機能が一部利用できないことがあります。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. 安全管理措置</h2>
                <p>当社は、個人情報の漏えい、滅失または毀損の防止等のため、合理的な安全管理措置を講じます。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. 保管期間</h2>
                <p>当社は、利用目的の達成に必要な範囲で情報を保管し、不要になった場合には適切な方法で削除します。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">8. 開示・訂正・削除等</h2>
                <p>利用者は、当社所定の手続により、個人情報の開示、訂正、利用停止、削除等を求めることができます。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">9. 未成年の利用</h2>
                <p>未成年の方は、保護者等の同意を得たうえで本サービスを利用してください。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">10. 本ポリシーの変更</h2>
                <p>当社は、必要に応じて本ポリシーを変更することがあります。変更後の内容は本サービス上への掲示等により効力を生じます。</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">11. お問い合わせ窓口</h2>
                <p>本ポリシーに関するお問い合わせは、以下までお願いいたします。</p>
                <p>運営者：株式会社キャリアエッセンス</p>
                <p>お問い合わせ：本サービス内「お問い合わせ」よりご連絡ください（または、運営者が別途定める方法）。</p>
              </section>

              <div className="mt-12 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-600">【制定日】2026年1月8日</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
