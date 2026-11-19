import PartnershipOperator from '@/components/partnerships/PartnershipOperator';
import { uuid } from '@/lib/partnerships/model';

export default async function PartnershipsPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams;
  const id = uuid.safeParse(school);
  return <PartnershipOperator initialSchool={id.success ? id.data : ''} />;
}
