import { apiPath } from '@/lib/base-path';
import type {
  EvidenceKind,
  GenerationStep,
  QualityScore,
  SeoDraftWithEvidence,
} from '@/lib/seo-generation/types';

const LOCAL_EVIDENCE_KINDS = new Set<EvidenceKind>([
  'review',
  'article',
  'school_info',
]);

export const GENERATION_STEP_LABELS: Record<GenerationStep, string> = {
  plan: '企画中...',
  research: '自社データ調査中...',
  'research-web': 'Web補足調査中...',
  write: '執筆中...',
  verify: '検証中...',
  rewrite: 'リライト中（品質改善）...',
  'generate-image': 'サムネイル画像生成中...',
};

export function hasSeoDraftOutline(outline: unknown): boolean {
  if (outline == null) return false;
  if (Array.isArray(outline)) return outline.length > 0;
  if (typeof outline === 'object') {
    return Object.keys(outline as object).length > 0;
  }
  return true;
}

/** plan〜write のうち、次に実行すべき1ステップ（verify より前） */
export function pickNextPipelineStepBeforeVerify(
  draft: Pick<SeoDraftWithEvidence, 'outline_json' | 'body_md' | 'evidence'>,
  includeWebResearch: boolean
): GenerationStep | null {
  const evidence = draft.evidence || [];
  if (!hasSeoDraftOutline(draft.outline_json)) return 'plan';
  if (!evidence.some((e) => LOCAL_EVIDENCE_KINDS.has(e.kind))) {
    return 'research';
  }
  if (includeWebResearch && !evidence.some((e) => e.kind === 'web')) {
    return 'research-web';
  }
  if (!draft.body_md?.trim()) return 'write';
  return null;
}

/**
 * 自動生成パイプラインに未完了が残っているか。
 * 品質が 75 未満だけ（サムネあり）は「リライト」向けとみなし、再開パネルでは扱わない。
 */
export function seoDraftHasPendingGenerationWork(
  draft: SeoDraftWithEvidence,
  includeWebResearch: boolean
): boolean {
  if (pickNextPipelineStepBeforeVerify(draft, includeWebResearch)) return true;
  if (!draft.body_md?.trim()) return false;
  if (!draft.quality_score) return true;
  if (!draft.featured_image_url?.trim()) return true;
  return false;
}

/** 下書き詳細の「生成を再開」パネルを出すか（検証後は status が draft になり得るため draft も含む） */
export function shouldShowGenerationResumePanel(
  draft: SeoDraftWithEvidence,
  includeWebResearch: boolean
): boolean {
  if (
    draft.status !== 'generating' &&
    draft.status !== 'failed' &&
    draft.status !== 'draft'
  ) {
    return false;
  }
  return seoDraftHasPendingGenerationWork(draft, includeWebResearch);
}

/** 品質確認済みだがサムネだけ欠けているとき（ステータスは draft 想定） */
export function shouldOfferThumbnailOnlyGeneration(
  draft: SeoDraftWithEvidence
): boolean {
  if (draft.status !== 'draft') return false;
  if (!draft.body_md?.trim()) return false;
  if (!draft.quality_score) return false;
  if (draft.quality_score.overall < 75) return false;
  return !draft.featured_image_url?.trim();
}

export async function postSeoGenerationStep(
  draftId: string,
  step: GenerationStep
): Promise<unknown> {
  const res = await fetch(apiPath(`/api/admin/seo-drafts/${draftId}/${step}`), {
    method: 'POST',
    credentials: 'include',
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `${step}に失敗しました`);
  }
  return body;
}

function readOverallFromVerifyPayload(
  data: unknown,
  fallback: QualityScore | null
): number {
  const fromPayload =
    data &&
    typeof data === 'object' &&
    'qualityScore' in data &&
    (data as { qualityScore?: { overall?: number } }).qualityScore?.overall;
  if (typeof fromPayload === 'number') return fromPayload;
  return fallback?.overall ?? 100;
}

/**
 * 新規作成ページを離れた場合など、DB の状態から残りの生成ステップを実行する。
 */
export async function executeSeoDraftGenerationResume(options: {
  draftId: string;
  includeWebResearch: boolean;
  fetchDraft: () => Promise<SeoDraftWithEvidence>;
  onStepStart?: (step: GenerationStep, label: string) => void;
  onStepDone?: (step: GenerationStep, elapsedMs: number, label: string) => void;
}): Promise<void> {
  const { draftId, includeWebResearch, fetchDraft, onStepStart, onStepDone } =
    options;

  while (true) {
    const d = await fetchDraft();
    const next = pickNextPipelineStepBeforeVerify(d, includeWebResearch);
    if (!next) break;
    const stepLabel = GENERATION_STEP_LABELS[next];
    onStepStart?.(next, stepLabel);
    const t0 = Date.now();
    await postSeoGenerationStep(draftId, next);
    onStepDone?.(next, Date.now() - t0, stepLabel);
  }

  let draft = await fetchDraft();
  if (!draft.body_md?.trim()) return;

  if (!draft.quality_score) {
    const firstVerifyLabel = GENERATION_STEP_LABELS.verify;
    onStepStart?.('verify', firstVerifyLabel);
    const t0 = Date.now();
    const verifyJson = await postSeoGenerationStep(draftId, 'verify');
    onStepDone?.('verify', Date.now() - t0, firstVerifyLabel);

    draft = await fetchDraft();
    const score = readOverallFromVerifyPayload(verifyJson, draft.quality_score);
    if (score < 75) {
      const rewriteLabel = GENERATION_STEP_LABELS.rewrite;
      onStepStart?.('rewrite', rewriteLabel);
      const t1 = Date.now();
      await postSeoGenerationStep(draftId, 'rewrite');
      onStepDone?.('rewrite', Date.now() - t1, rewriteLabel);

      const secondVerifyLabel = '再検証中...';
      onStepStart?.('verify', secondVerifyLabel);
      const t2 = Date.now();
      await postSeoGenerationStep(draftId, 'verify');
      onStepDone?.('verify', Date.now() - t2, secondVerifyLabel);
    }
  } else if (draft.quality_score.overall < 75) {
    const rewriteLabel = GENERATION_STEP_LABELS.rewrite;
    onStepStart?.('rewrite', rewriteLabel);
    const t0 = Date.now();
    await postSeoGenerationStep(draftId, 'rewrite');
    onStepDone?.('rewrite', Date.now() - t0, rewriteLabel);

    const secondVerifyLabel = '再検証中...';
    onStepStart?.('verify', secondVerifyLabel);
    const t1 = Date.now();
    await postSeoGenerationStep(draftId, 'verify');
    onStepDone?.('verify', Date.now() - t1, secondVerifyLabel);
  }

  draft = await fetchDraft();
  if (!draft.featured_image_url?.trim()) {
    const imgLabel = GENERATION_STEP_LABELS['generate-image'];
    onStepStart?.('generate-image', imgLabel);
    const t0 = Date.now();
    await postSeoGenerationStep(draftId, 'generate-image');
    onStepDone?.('generate-image', Date.now() - t0, imgLabel);
  }
}

export async function executeThumbnailGenerationOnly(options: {
  draftId: string;
  fetchDraft: () => Promise<SeoDraftWithEvidence>;
  onStepStart?: (step: GenerationStep, label: string) => void;
  onStepDone?: (step: GenerationStep, elapsedMs: number, label: string) => void;
}): Promise<void> {
  const { draftId, fetchDraft, onStepStart, onStepDone } = options;
  const imgLabel = GENERATION_STEP_LABELS['generate-image'];
  onStepStart?.('generate-image', imgLabel);
  const t0 = Date.now();
  await postSeoGenerationStep(draftId, 'generate-image');
  onStepDone?.('generate-image', Date.now() - t0, imgLabel);
  await fetchDraft();
}
