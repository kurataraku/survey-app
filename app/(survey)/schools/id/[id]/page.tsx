import { redirect, notFound } from 'next/navigation';
import { getSchoolById } from '@/lib/schools/getSchoolById';
import SchoolDetailByIdClient from '@/components/SchoolDetailByIdClient';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { appPath } from '@/lib/base-path';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const school = await getSchoolById(resolved.id);

  if (!school) {
    return { title: '学校が見つかりません' };
  }

  const title = `${school.name}の口コミ・評判`;
  const description = `${school.name}の口コミ・評判をまとめました。在校生・卒業生・保護者の生の声を掲載しています。`;
  const canonical = `${getAppBaseUrl()}/schools/id/${resolved.id}`;

  return {
    title,
    description,
    alternates: { canonical },
  };
}

export default async function SchoolDetailByIdPage({ params }: PageProps) {
  const resolved = params instanceof Promise ? await params : params;
  const id = resolved.id;

  const school = await getSchoolById(id);

  if (!school) {
    notFound();
  }

  if (school.slug && school.slug.trim() !== '') {
    redirect(appPath(`/schools/${encodeURIComponent(school.slug)}`));
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <SchoolDetailByIdClient school={school} schoolId={id} />
      </div>
    </div>
  );
}
