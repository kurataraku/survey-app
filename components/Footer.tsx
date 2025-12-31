import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    main: [
      { href: '/', label: 'ホーム' },
      { href: '/schools', label: '学校検索' },
      { href: '/rankings', label: 'ランキング' },
      { href: '/features', label: '特集' },
      { href: '/survey', label: '口コミ投稿' },
    ],
    about: [
      { href: '/about', label: 'サイトについて' },
      { href: '/guide', label: '通信制高校ガイド' },
    ],
    legal: [
      { href: '/terms', label: '利用規約' },
      { href: '/privacy', label: 'プライバシーポリシー' },
      { href: '/contact', label: 'お問い合わせ' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* サイト情報 */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-white text-lg font-bold mb-4">通信制高校リアルレビュー</h3>
            <p className="text-sm text-gray-400 mb-4">
              通信制高校に関するリアルな口コミ・レビューを集めたメディアサイトです。
              あなたの経験が、次に悩む人の力になります。
            </p>
          </div>

          {/* メインナビゲーション */}
          <div>
            <h4 className="text-white font-semibold mb-4">メイン</h4>
            <ul className="space-y-2">
              {footerLinks.main.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-orange-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* その他リンク */}
          <div>
            <h4 className="text-white font-semibold mb-4">その他</h4>
            <ul className="space-y-2">
              {footerLinks.about.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-orange-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-orange-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* コピーライト */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <p className="text-sm text-gray-400 text-center">
            © {currentYear} 通信制高校リアルレビュー. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

