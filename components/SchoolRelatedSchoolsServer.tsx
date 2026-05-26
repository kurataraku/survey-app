import SchoolCardServer from '@/components/SchoolCardServer';
import { getRelatedSchools } from '@/lib/schools/getRelatedSchools';

interface SchoolRelatedSchoolsServerProps {
  schoolId: string;
  schoolName: string;
  prefecture: string | null;
  prefectures?: string[] | null;
}

export default async function SchoolRelatedSchoolsServer({
  schoolId,
  schoolName,
  prefecture,
  prefectures,
}: SchoolRelatedSchoolsServerProps) {
  const schools = await getRelatedSchools({
    schoolId,
    prefecture,
    prefectures,
    limit: 4,
  });

  if (schools.length === 0) return null;

  return (
    <section
      id="section-related-schools"
      className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200"
      aria-labelledby="related-schools-heading"
    >
      <h2 id="related-schools-heading" className="text-xl font-bold text-gray-900 mb-3">
        {schoolName}とあわせて比較したい学校
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        同じ地域や広域対応の通信制高校を、口コミ数や評価傾向をもとに候補として表示しています。学費、通学頻度、サポート体制は学校ごとに確認してください。
      </p>
      <div className="grid gap-5">
        {schools.map((school) => (
          <SchoolCardServer
            key={school.id}
            id={school.id}
            name={school.name}
            prefecture={school.prefecture}
            prefectures={school.prefectures ?? undefined}
            institutionType={school.institution_type}
            campusLocations={school.campus_locations}
            matchedPrefecture={prefecture || undefined}
            slug={school.slug}
            highlights={school.highlights}
            intro={school.intro}
            reviewCount={school.review_count}
            overallAvg={school.overall_avg}
            tuitionAvg={school.tuition_avg}
            supportAvg={school.support_avg}
            flexibilityAvg={school.flexibility_avg}
            primaryMetric="reviews"
          />
        ))}
      </div>
    </section>
  );
}
