/** GA4 カスタムイベント名（計画書と統一） */
export const GA_EVENTS = {
  regionSchoolClick: 'region_school_click',
  schoolDetailView: 'school_detail_view',
  diagnosisStartClick: 'diagnosis_start_click',
  reviewPostClick: 'review_post_click',
  requestNotificationClick: 'request_notification_click',
  requestNotificationSubmit: 'request_notification_submit',
  ctaCampaignClick: 'cta_campaign_click',
  ctaSurvey: 'cta_survey',
  ctaSurveyFromSchool: 'cta_survey_from_school',
  consultationAiOpen: 'consultation_ai_open',
  consultationAiSend: 'consultation_ai_send',
  consultationAiSourceClick: 'consultation_ai_source_click',
} as const;

export type GaEventName = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];
