import type { SchoolInstitutionType } from '@/lib/types/schools';

export const INSTITUTION_TYPE_LABEL: Record<SchoolInstitutionType, string> = {
  public: '公立',
  private: '私立',
  support: 'サポート校',
};

export const INSTITUTION_TYPE_FULL_LABEL: Record<SchoolInstitutionType, string> = {
  public: '公立の通信制高校',
  private: '私立の通信制高校',
  support: 'サポート校（通信制高校ではありません）',
};

/**
 * サポート校の学費欄に必ず出す注記。
 *
 * サポート校は高校ではなく、卒業資格は提携する通信制高校で取る。
 * つまり学費欄の金額は「かかる費用の一部」でしかない。
 * 注記なしで通信制高校の初年度納入金と並べると、同じ条件の金額に見えてしまう。
 */
export const SUPPORT_SCHOOL_TUITION_CAUTION =
  'サポート校は通信制高校ではなく、学習や生活を支援する施設です。高校卒業資格は提携する通信制高校で取得するため、ここに掲載している費用とは別に、その通信制高校の入学金・授業料などが必要になります。通信制高校の初年度納入金と同じ条件の金額ではないため、比較する際は両方を合計してご確認ください。';

export function isSupportSchool(type: SchoolInstitutionType | null | undefined): boolean {
  return type === 'support';
}
