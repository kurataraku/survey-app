export const MY_STORY_AWARD_PATH = '/my-story-award';
export const MY_STORY_AWARD_APPLY_PATH = '/my-story-award/apply';
export const MY_STORY_AWARD_SOURCE = 'my_story_award' as const;
export const MY_STORY_AWARD_DEADLINE_LABEL = '2026年12月25日 23:59';
export const MY_STORY_AWARD_DEADLINE_ISO = '2026-12-25T14:59:00.000Z';

export const CONTEST_TEXT_LIMITS = {
  title: { max: 20 },
  effort_summary: { min: 20, target: 100 },
  before_enrollment: { min: 50, target: 300 },
  after_enrollment: { min: 50, target: 300 },
  learning_and_change: { min: 50, target: 300 },
  future_goal: { min: 20, target: 200 },
  current_life: { min: 20, target: 200 },
} as const;

export const CONTEST_AWARDS = [
  { name: '最優秀賞', amount: '10,000円分', count: '1名' },
  { name: '優秀賞', amount: '5,000円分', count: '1名' },
  { name: '審査員特別賞', amount: '3,000円分', count: '2名' },
] as const;

export const CONTEST_REVIEW_INTRO =
  'ここからは、学校を選ぶ人の参考になる回答です。確認後に200円分が届きます。';

export const CONTEST_CHAPTERS = {
  story: 'あなたの高校生活',
  review: '学校のことを教える',
  confirm: '送る前の確認',
} as const;

export const CONTEST_STORAGE_KEY = 'my-story-award-draft';
