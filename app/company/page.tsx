import type { Metadata } from 'next';
import Link from 'next/link';
import {
  COMPANY,
  VISION,
  MISSION,
  FEATURED_SERVICE,
  OTHER_SERVICES,
  EXECUTIVE,
} from '@/lib/company-content';
import { getSiteUrl } from '@/lib/env-check';

const siteUrl = getSiteUrl().replace(/\/$/, '');
const canonical = siteUrl + '/';
const description = `${COMPANY.name}の公式サイト。${COMPANY.catchphrase}`;
const title = `${COMPANY.name} | ${COMPANY.catchphrase}`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: canonical,
    title,
    description,
    images: [{ url: `${siteUrl}${COMPANY.logoPath}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

function ServiceLogoCard({
  service,
}: {
  service: {
    name: string;
    description: string;
    href: string | null;
    hasButton: boolean;
    logoPath: string;
  };
}) {
  const isExternal = service.href?.startsWith('http') ?? false;

  return (
    <article
      className="rounded-[var(--company-radius-card)] border border-[var(--company-primary)]/20 bg-white p-6 sm:p-8"
      style={{
        boxShadow: 'var(--company-shadow-card)',
        background: 'linear-gradient(135deg, #ffffff 0%, #f5f9ff 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-7 md:flex-row md:items-center md:gap-10">
        <div className="flex w-full justify-center md:w-[320px] md:shrink-0">
          <img
            src={service.logoPath}
            alt={service.name}
            className="h-auto w-full max-w-[300px] rounded-xl"
            width={640}
            height={360}
          />
        </div>

        <div className="min-w-0 flex-1 text-center md:text-left">
          <p
            className="text-[15px]"
            style={{
              color: 'var(--company-muted)',
              lineHeight: 'var(--company-line-height-relaxed)',
            }}
          >
            {service.description}
          </p>
          {service.hasButton && service.href ? (
            <Link
              href={service.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noreferrer' : undefined}
              className="mt-5 inline-flex items-center justify-center rounded-[var(--company-radius-btn)] bg-[var(--company-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--company-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--company-primary)] focus-visible:ring-offset-2"
            >
              くわしく見る
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SectionHeading({
  id,
  label,
  sublabel,
  children,
}: {
  id: string;
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      {sublabel ? (
        <div className="mb-6">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--company-muted)' }}
          >
            {label}
          </p>
          <h2
            className="mt-1 text-xl font-bold sm:text-2xl"
            style={{ color: 'var(--company-text)', fontSize: 'var(--company-font-size-h2)' }}
          >
            {sublabel}
          </h2>
        </div>
      ) : (
        <h2
          className="mb-6 text-xl font-bold sm:text-2xl"
          style={{ color: 'var(--company-text)', fontSize: 'var(--company-font-size-h2)' }}
        >
          {label}
        </h2>
      )}
      {children}
    </section>
  );
}

export default function CompanyTopPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8 lg:pt-28"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 45%, #eef5ff 100%)',
        }}
      >
        {/* 装飾: 右側の青グラデーション（うっすら・箱なし） */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 85% 50%, rgba(72,148,239,0.08) 0%, transparent 60%)',
          }}
        />
        <div
          className="mx-auto relative text-center"
          style={{ maxWidth: 'var(--company-container-max)' }}
        >
          <h1
            className="font-bold leading-tight"
            style={{
              color: 'var(--company-text)',
              fontSize: 'var(--company-font-size-hero)',
              lineHeight: 'var(--company-line-height-tight)',
            }}
          >
            {COMPANY.catchphrase}
          </h1>
          <p
            className="mt-5 text-base sm:text-lg"
            style={{
              color: 'var(--company-muted)',
              lineHeight: 'var(--company-line-height-relaxed)',
            }}
          >
            {COMPANY.subCatchphrase}
          </p>
        </div>
      </section>

      <div
        className="mx-auto flex flex-col px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:px-8"
        style={{ maxWidth: 'var(--company-container-max)', gap: 'var(--company-section-gap)' }}
      >
        {/* Business */}
        <SectionHeading id="services" label="事業内容">
          <div className="flex flex-col" style={{ gap: 'var(--company-gutter-lg)' }}>
            <ServiceLogoCard service={FEATURED_SERVICE} />

            {OTHER_SERVICES.map((s) => (
              <ServiceLogoCard key={s.id} service={s} />
            ))}
          </div>
        </SectionHeading>

        {/* Executive */}
        <SectionHeading id="executive" label="代表紹介">
          <div
            className="flex flex-col gap-6 rounded-[var(--company-radius-card)] border border-gray-200/80 bg-white p-6 sm:flex-row sm:items-start sm:gap-10 sm:p-8"
            style={{ boxShadow: 'var(--company-shadow-card)' }}
          >
            <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-[var(--company-bg-alt)] sm:h-48 sm:w-48">
              <img
                src={EXECUTIVE.photoPath}
                alt={EXECUTIVE.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--company-muted)' }}
              >
                {EXECUTIVE.title}
              </p>
              <p
                className="mt-1 text-lg font-semibold sm:text-xl"
                style={{ color: 'var(--company-text)' }}
              >
                {EXECUTIVE.name}
              </p>
              <div
                className="mt-3 whitespace-pre-line border-t border-gray-200/60 pt-3 text-[11px] sm:mt-4 sm:pt-4 sm:text-[12px]"
                style={{
                  color: 'var(--company-muted)',
                  lineHeight: '1.6',
                  fontFamily: 'var(--font-geist-sans), "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
                }}
              >
                {EXECUTIVE.comment.split(/(\d{4}年)/g).map((part, i) =>
                  /^\d{4}年$/.test(part) ? (
                    <span
                      key={i}
                      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
                    >
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )}
              </div>
            </div>
          </div>
        </SectionHeading>

        {/* Vision */}
        <SectionHeading id="vision" label={VISION.heading} sublabel={VISION.main}>
          <div
            className="whitespace-pre-line text-[15px]"
            style={{
              color: 'var(--company-muted)',
              lineHeight: 'var(--company-line-height-relaxed)',
            }}
          >
            {VISION.sub}
          </div>
        </SectionHeading>

        {/* Mission */}
        <SectionHeading id="mission" label={MISSION.heading} sublabel={MISSION.main}>
          <div
            className="whitespace-pre-line text-[15px]"
            style={{
              color: 'var(--company-muted)',
              lineHeight: 'var(--company-line-height-relaxed)',
            }}
          >
            {MISSION.sub}
          </div>
        </SectionHeading>
      </div>
    </>
  );
}
