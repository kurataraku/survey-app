import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, Cpu, Users } from 'lucide-react';
import {
  COMPANY,
  VISION,
  MISSION,
  SERVICES,
  EXECUTIVE,
} from '@/lib/company-content';
import { appPath } from '@/lib/base-path';

export const metadata: Metadata = {
  title: `${COMPANY.name} | ${COMPANY.catchphrase}`,
  description: `${COMPANY.name}の公式サイト。${COMPANY.catchphrase}`,
};

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tsushin: GraduationCap,
  dx: Cpu,
  rpo: Users,
};

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
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        }}
      >
        {/* 装飾: 右側の抽象図形（SPでは非表示） */}
        <div
          className="absolute right-0 top-1/2 hidden h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full opacity-20 lg:block"
          style={{
            background: 'radial-gradient(circle, var(--company-primary) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 hidden h-32 w-32 rounded-2xl opacity-10 lg:block"
          style={{
            background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-primary-light) 100%)',
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
        className="mx-auto flex flex-col px-4 pb-24 sm:px-6 lg:px-8"
        style={{ maxWidth: 'var(--company-container-max)', gap: 'var(--company-section-gap)' }}
      >
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

        {/* Services */}
        <SectionHeading id="services" label="サービス">
          <div
            className="grid gap-6 sm:grid-cols-1 md:grid-cols-3"
            style={{ gap: 'var(--company-gutter-lg)' }}
          >
            {SERVICES.map((s) => {
              const Icon = SERVICE_ICONS[s.id] ?? Users;
              return (
                <div
                  key={s.id}
                  className="rounded-[var(--company-radius-card)] border border-gray-200/80 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--company-primary)]/30 hover:shadow-[var(--company-shadow-card-hover)]"
                  style={{ boxShadow: 'var(--company-shadow-card)' }}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'rgba(72,148,239,0.1)', color: 'var(--company-primary)' }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3
                    className="mb-3 text-base font-semibold"
                    style={{ color: 'var(--company-text)' }}
                  >
                    {s.name}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: 'var(--company-muted)',
                      lineHeight: 'var(--company-line-height-relaxed)',
                    }}
                  >
                    {s.description}
                  </p>
                  {s.hasButton && s.href && (
                    <Link
                      href={s.href}
                      className="mt-4 inline-flex items-center justify-center rounded-[var(--company-radius-btn)] bg-[var(--company-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--company-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--company-primary)] focus-visible:ring-offset-2"
                    >
                      くわしく見る
                    </Link>
                  )}
                </div>
              );
            })}
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
                {EXECUTIVE.comment}
              </div>
            </div>
          </div>
        </SectionHeading>
      </div>
    </>
  );
}
