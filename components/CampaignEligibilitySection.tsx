import {
  CAMPAIGN_ELIGIBILITY_INTRO,
  CAMPAIGN_ELIGIBILITY_ITEMS,
  CAMPAIGN_ELIGIBILITY_TITLE,
} from '@/lib/campaign/copy';

interface CampaignEligibilitySectionProps {
  id?: string;
}

export default function CampaignEligibilitySection({
  id = 'eligibility',
}: CampaignEligibilitySectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-base sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2 whitespace-nowrap">
        {CAMPAIGN_ELIGIBILITY_TITLE}
      </h2>
      <p className="text-xs sm:text-sm text-amber-800 font-medium mb-2 sm:mb-4">{CAMPAIGN_ELIGIBILITY_INTRO}</p>
      <ul className="space-y-1 sm:space-y-3 text-xs sm:text-base text-gray-700 leading-snug sm:leading-relaxed list-disc pl-4 sm:pl-5 marker:text-amber-600">
        {CAMPAIGN_ELIGIBILITY_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
