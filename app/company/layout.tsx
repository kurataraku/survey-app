import Link from 'next/link';
import { COMPANY, ADDRESS } from '@/lib/company-content';
import { appPath } from '@/lib/base-path';

const navItems = [
  { href: '#vision', label: 'VISION' },
  { href: '#mission', label: 'MISSION' },
  { href: '#services', label: 'サービス' },
  { href: '#executive', label: '代表紹介' },
  { href: '#contact', label: 'お問い合わせ' },
];

function ContactCta({ className = '' }: { className?: string }) {
  return (
    <Link
      href={appPath('/contact')}
      className={`inline-flex items-center justify-center rounded-[var(--company-radius-btn)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 ${className}`}
      style={{ backgroundColor: 'var(--company-primary)' }}
    >
      お問い合わせ
    </Link>
  );
}

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--company-bg)' }}>
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: 'var(--company-bg)',
          borderColor: 'rgba(0,0,0,0.08)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold"
            style={{ color: 'var(--company-text)' }}
          >
            {COMPANY.name}
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: 'var(--company-text)' }}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-4">
            <ContactCta className="hidden sm:inline-flex" />
          </div>
        </div>
        {/* モバイル用ナビ: アンカーはページ内なのでシンプルに */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                color: 'var(--company-muted)',
                backgroundColor: 'var(--company-bg-alt)',
              }}
            >
              {item.label}
            </a>
          ))}
          <ContactCta className="shrink-0 sm:hidden" />
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      <footer
        className="mt-24 border-t py-12"
        style={{
          backgroundColor: 'var(--company-bg-alt)',
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--company-text)' }}>
                {COMPANY.name}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--company-muted)' }}>
                {ADDRESS.postal}
                <br />
                {ADDRESS.line1}
                <br />
                {ADDRESS.line2}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href={appPath('/privacy')}
                className="text-sm hover:underline"
                style={{ color: 'var(--company-primary)' }}
              >
                プライバシーポリシー
              </Link>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline"
                style={{ color: 'var(--company-primary)' }}
              >
                サイトマップ
              </a>
              <ContactCta />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
