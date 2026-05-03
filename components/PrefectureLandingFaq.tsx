import { buildPrefectureFaqItems } from '@/lib/prefectures/prefecture-landing-schema';

interface PrefectureLandingFaqProps {
  prefecture: string;
}

export default function PrefectureLandingFaq({ prefecture }: PrefectureLandingFaqProps) {
  const items = buildPrefectureFaqItems(prefecture);

  return (
    <section className="mt-12 rounded-xl border border-gray-200 bg-white p-6 md:p-8" aria-labelledby="pref-faq-heading">
      <h2 id="pref-faq-heading" className="text-xl font-bold text-gray-900 mb-4">
        {prefecture}の通信制高校でよくある質問
      </h2>
      <dl className="space-y-6">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="font-semibold text-gray-900 mb-2">{item.question}</dt>
            <dd className="text-gray-700 text-sm leading-relaxed">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
