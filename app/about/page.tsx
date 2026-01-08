import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'このサイトについて｜通信制高校リアルレビュー',
  description: '通信制高校の選び直しを支える、リアルな口コミメディア。入学前に知りたい「本当のこと」を、実際に通った人の声で届けます。後悔のない選択が、未来の一歩になります。',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50 py-16 sm:py-24 overflow-hidden">
        {/* 装飾用のブラー円 */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30 -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-20 -ml-48 -mb-48"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            あなたに本当にあう学校を<br />
            一緒にさがそう
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 font-light max-w-2xl mx-auto leading-relaxed">
            通信制高校に関するリアルな声で<br />
            あなたの未来を支えます
          </p>
        </div>
      </section>

      {/* 本文セクション */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* セクション1 */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative pl-4 border-l-4 border-blue-500">
            通信制高校で見つける「自分に合った未来」
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-6">
            <p>
              通信制高校は、いじめや人間関係の悩み、起立性調節障害や発達障害、自律神経の不調など、さまざまな理由で学校に通うことが難しくなった人が、もう一度自分に合った学びの場を見つけ、社会とのつながりを保ち続けるための大切な選択肢です。
            </p>
            <p>
              同時に、画一的で一律な学校の枠組みでは、自分らしい学び方ができないと感じる人にとっても、通信制高校は「自分に合った未来」を掴むための貴重な学びの場です。
            </p>
          </div>
        </section>

        {/* セクション2 */}
        <section className="mb-16 sm:mb-20 bg-gray-50 rounded-lg p-8 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative border-l-4 border-blue-500" style={{ paddingLeft: '1rem' }}>
            「普通」ってなんだろう
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-6">
            <p>
              不登校という状態だけを見て、自分を責めてしまう人がいます。<br />
              でも、学校が合わないことは、あなたの価値とは関係ありません。
            </p>
            <p>
              たまたまその学校との相性が合わないこともある。<br />
              社会が長く続けてきた「こうあるべき」という枠組みが合わないこともある。
            </p>
            <p>
              だからこそ、全日制の学校が自分に合わないことに、過度に悩む必要はないと私たちは考えています。大切なのは、「自分に合う環境」を見つけ直すこと。そして、自分のペースで前に進める場所に出会うことです。
            </p>
          </div>
        </section>

        {/* セクション3 */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative pl-4 border-l-4 border-blue-500">
            悔いのない選択が、未来の一歩になる
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-6">
            <p>
              通信制高校を選ぶ人の多くは、<br />
              「もう一度社会と関わりたい」<br />
              「自分らしい学び方をしたい」<br />
              そんな強い想いを抱えています。
            </p>
            <p>
              だからこそ、悔いのない選択をしてほしい。<br />
              そして、通信制高校に入って「ここを選んでよかった」と思える人が、もっと増えてほしい。<br />
              このサイトは、そのために存在しています。
            </p>
          </div>
        </section>

        {/* セクション4 */}
        <section className="mb-16 sm:mb-20 bg-gray-50 rounded-lg p-8 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative border-l-4 border-blue-500" style={{ paddingLeft: '1rem' }}>
            入学前に「リアル」を知るのは、意外と難しい
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-6">
            <p>
              学校は、良くも悪くも"閉ざされやすい"場所です。<br />
              入学前に、その学校のリアルを知ることは簡単ではありません。
            </p>
            <p>
              学校の公式サイトや一般的な学校比較サイトには、学校が伝えたい魅力が中心に掲載されることがほとんどです。<br />
              説明会やオープンスクールでも、どうしても良い一面が前面に出やすい。もちろんそれは悪いことではありませんが、「本当に知りたいこと」に届かないこともあります。
            </p>
            <p>
              たとえば——
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2 text-gray-700">
              <li>実際の通学頻度や、授業の進み方</li>
              <li>サポートの現場感（相談しやすさ、対応の温度感）</li>
              <li>生徒の雰囲気や、居場所のつくりやすさ</li>
              <li>単位取得や課題の負荷感</li>
              <li>合う人・合わない人の傾向</li>
            </ul>
            <p>
              こうした「入学してみないと分からない情報」は、入学前の不安が大きいほど、知る手段が限られてしまいます。
            </p>
          </div>
        </section>

        {/* 引用カード2 */}
        <div className="mb-16 sm:mb-20">
          <p className="text-gray-700 text-base sm:text-lg leading-relaxed">
            通信制高校を選ぶことは、逃げではありません。<br />
            自分を守り、未来を取り戻すための、立派な選択です。
          </p>
        </div>

        {/* セクション5 */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative pl-4 border-l-4 border-blue-500">
            リアルな声が、未来の選択を支える
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-6">
            <p>
              だからこそ、実際に通った人のリアルな声にふれて、より良い選択をしてほしい。<br />
              このサイトは、口コミという一次情報を通じて、未来に悩む生徒・保護者が「本当に知りたかったこと」に答えられる場所を目指しています。
            </p>
            <p>
              通信制高校を選ぶことは、逃げではありません。<br />
              自分を守り、未来を取り戻すための、立派な選択です。
            </p>
            <p>
              そしてその選択が、より良いものになるように。<br />
              私たちは、誠実にこのメディアを運営していきます。
            </p>
          </div>
        </section>

        {/* お願いセクション */}
        <section className="mb-16 sm:mb-20 bg-amber-50 border border-amber-200 rounded-lg p-8 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 relative border-l-4 border-amber-500" style={{ paddingLeft: '1rem' }}>
            お願い
          </h2>
          <div className="text-gray-700 text-base sm:text-lg leading-relaxed space-y-4">
            <p>
              口コミは、誰かの未来を支える大切な情報になります。<br />
              個人が特定される内容や、特定の個人への攻撃につながる表現は避けつつ、あなたが感じたことを、あなたの言葉で共有してください。
            </p>
            <p className="font-semibold text-gray-900">
              あなたの声が、次の誰かの「一歩」を後押しします。
            </p>
          </div>
        </section>

        {/* CTAセクション */}
        <section className="text-center py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
            次の一歩を、一緒に
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/schools"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg shadow-md hover:shadow-lg"
            >
              学校を検索する
            </Link>
            <Link
              href="/survey"
              className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-lg shadow-md hover:shadow-lg"
            >
              口コミを書く
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
