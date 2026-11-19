'use client';

import Image from 'next/image';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import type { PublicPartnership } from '@/lib/partnerships/server';

export default function SchoolPartnershipCard({ partnership, schoolId, slug }: { partnership: PublicPartnership; schoolId: string; slug: string }) {
  const { officialUrl, requestEnabled, photo, message } = partnership;
  if (!officialUrl && !requestEnabled && !photo && !message) return null;
  const params = { school_id: schoolId, school_slug: slug, placement: 'school_detail' };

  return (
    <section className="mb-8 space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6" aria-label="学校からのご案内">
      {(requestEnabled || officialUrl) && <div className="flex flex-col gap-3 sm:flex-row">
        {requestEnabled && <Link href={appPath(`/schools/${encodeURIComponent(slug)}/request`)} className="rounded-xl bg-blue-700 px-5 py-3 text-center font-semibold text-white"
          onClick={() => trackEvent(GA_EVENTS.schoolMaterialRequestClick, params)}>無料で資料請求</Link>}
        {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-blue-300 px-5 py-3 text-center font-semibold text-blue-800"
          onClick={() => trackEvent(GA_EVENTS.schoolOfficialSiteClick, params)}>公式サイトを見る</a>}
      </div>}
      {requestEnabled && <p className="text-sm text-slate-600">資料は学校から郵送されます。</p>}
      {photo && <figure>
        <Image unoptimized width={1200} height={750} className="max-h-[480px] w-full rounded-xl object-contain" src={apiPath(`/api/school-partnerships/photo/${photo.id}`)} alt={photo.alt} />
        <figcaption className="mt-2 text-sm text-slate-600">{photo.caption ? `${photo.caption}（学校提供）` : '写真は学校提供'}</figcaption>
      </figure>}
      {message && <div className="rounded-xl bg-slate-50 p-4">
        <h2 className="mb-2 font-bold">学校からのメッセージ</h2>
        <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">{message}</p>
      </div>}
    </section>
  );
}
