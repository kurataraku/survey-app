import type { Metadata } from 'next';
import Link from 'next/link';
import {
  COMPANY,
  VISION,
  MISSION,
  SERVICES,
  EXECUTIVE,
  ADDRESS,
} from '@/lib/company-content';
import { appPath } from '@/lib/base-path';

export const metadata: Metadata = {
  title: `${COMPANY.name} | ${COMPANY.catchphrase}`,
  description: `${COMPANY.name}の公式サイト。${COMPANY.catchphrase}`,
};

function SectionHeading({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2
        className="mb-6 text-xl font-bold sm:text-2xl"
        style={{ color: 'var(--company-text)' }}
      >
        {label}
      </h2>
      {children}
    </section>
  );
}

export default function CompanyTopPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--company-bg)] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1
            className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl"
            style={{ color: 'var(--company-text)' }}
          >
            {COMPANY.catchphrase}
          </h1>
          <p
            className="mt-4 text-base sm:text-lg"
            style={{ color: 'var(--company-muted)' }}
          >
            {COMPANY.name}
          </p>
          <div className="mt-8">
            <Link
              href={appPath('/contact')}
              className="inline-flex items-center justify-center rounded-[var(--company-radius-btn)] px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--company-primary)' }}
            >
              お問い合わせ
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Vision */}
        <SectionHeading id="vision" label={VISION.heading}>
          <p
            className="mb-4 text-lg font-semibold"
            style={{ color: 'var(--company-primary)' }}
          >
            {VISION.main}
          </p>
          <div
            className="whitespace-pre-line text-[15px] leading-relaxed"
            style={{ color: 'var(--company-muted)' }}
          >
            {VISION.sub}
          </div>
        </SectionHeading>

        {/* Mission */}
        <SectionHeading id="mission" label={MISSION.heading}>
          <p
            className="mb-4 text-lg font-semibold"
            style={{ color: 'var(--company-primary)' }}
          >
            {MISSION.main}
          </p>
          <div
            className="whitespace-pre-line text-[15px] leading-relaxed"
            style={{ color: 'var(--company-muted)' }}
          >
            {MISSION.sub}
          </div>
        </SectionHeading>

        {/* Services */}
        <SectionHeading id="services" label="サービス">
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                key={s.id}
                className="rounded-[var(--company-radius-card)] border border-gray-200/80 bg-white p-6"
                style={{ boxShadow: 'var(--company-shadow-card)' }}
              >
                <h3
                  className="mb-3 text-base font-semibold"
                  style={{ color: 'var(--company-text)' }}
                >
                  {s.name}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--company-muted)' }}
                >
                  {s.description}
                </p>
                {s.hasButton && s.href && (
                  <Link
                    href={s.href}
                    className="mt-4 inline-flex items-center justify-center rounded-[var(--company-radius-btn)] bg-[var(--company-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    くわしく見る
                  </Link>
                )}
              </div>
            ))}
          </div>
        </SectionHeading>

        {/* Executive */}
        <SectionHeading id="executive" label="代表紹介">
          <div
            className="flex flex-col gap-6 rounded-[var(--company-radius-card)] border border-gray-200/80 bg-white p-6 sm:flex-row sm:items-start"
            style={{ boxShadow: 'var(--company-shadow-card)' }}
          >
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--company-bg-alt)] sm:h-36 sm:w-36">
              {/* 写真は public/company/rep-photo.jpg に配置してください */}
              <img
                src={EXECUTIVE.photoPath}
                alt={EXECUTIVE.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--company-muted)' }}
              >
                {EXECUTIVE.title}
              </p>
              <p
                className="mt-1 text-xl font-semibold"
                style={{ color: 'var(--company-text)' }}
              >
                {EXECUTIVE.name}
              </p>
            </div>
          </div>
        </SectionHeading>

        {/* Contact */}
        <section id="contact" className="scroll-mt-24">
          <h2
            className="mb-6 text-xl font-bold sm:text-2xl"
            style={{ color: 'var(--company-text)' }}
          >
            お問い合わせ
          </h2>
          <div
            className="rounded-[var(--company-radius-card)] border border-gray-200/80 bg-white p-6 sm:p-8"
            style={{ boxShadow: 'var(--company-shadow-card)' }}
          >
            <p
              className="mb-2 text-sm"
              style={{ color: 'var(--company-muted)' }}
            >
              {ADDRESS.postal} {ADDRESS.line1} {ADDRESS.line2}
            </p>
            <Link
              href={appPath('/contact')}
              className="mt-4 inline-flex items-center justify-center rounded-[var(--company-radius-btn)] px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--company-primary)' }}
            >
              お問い合わせフォームへ
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
