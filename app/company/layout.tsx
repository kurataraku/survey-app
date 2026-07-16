import Link from 'next/link';
import { COMPANY, ADDRESS } from '@/lib/company-content';

const navItems = [
  { href: '#services', label: '事業内容' },
  { href: '#executive', label: '代表紹介' },
  { href: '#vision', label: 'VISION' },
  { href: '#mission', label: 'MISSION' },
];

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--company-bg)' }}>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderColor: 'rgba(0,0,0,0.06)',
          boxShadow: 'var(--company-shadow-header)',
        }}
      >
        <div
          className="mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: 'var(--company-container-max)' }}
        >
          <Link
            href="/"
            className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--company-primary)] focus-visible:ring-offset-2 rounded"
          >
            <img
              src={COMPANY.logoPath}
              alt={COMPANY.name}
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--company-primary)] focus-visible:ring-offset-2 rounded px-1"
                style={{ color: 'var(--company-text)' }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        {/* モバイル用ナビ: アンカーはページ内なのでシンプルに */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 md:hidden">
          {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-4 py-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--company-primary)] focus-visible:ring-offset-2"
                style={{
                  color: 'var(--company-muted)',
                  backgroundColor: 'var(--company-bg-alt)',
                }}
              >
                {item.label}
              </a>
            ))}
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      <footer
        className="mt-24 border-t py-16"
        style={{
          backgroundColor: 'var(--company-bg-alt)',
          borderColor: 'rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: 'var(--company-container-max)' }}
        >
          <div>
            <p
              className="text-base font-semibold"
              style={{ color: 'var(--company-text)' }}
            >
              {COMPANY.name}
            </p>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{
                color: 'var(--company-muted)',
                fontFamily: 'var(--font-geist-sans), "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
              }}
            >
              {ADDRESS.postal}
              <br />
              {ADDRESS.line1}
              <br />
              {ADDRESS.line2}
            </p>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{
                color: 'var(--company-muted)',
                fontFamily: 'var(--font-geist-sans), "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
              }}
            >
              設立　{COMPANY.established}
              <br />
              連絡先　{COMPANY.contactEmail}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
