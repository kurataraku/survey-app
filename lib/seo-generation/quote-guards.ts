import type { QualityIssue, SeoDraftEvidence } from './types';

type EvidenceRow = Omit<SeoDraftEvidence, 'id' | 'draft_id' | 'retrieved_at'>;

/** 「」直前に校名が書かれるパターンの取りこぼしを減らす */
const PRE_CHARS = 360;
const POST_CHARS = 160;

/** section_ref 例: 「東京都立砂川高等学校（当サイトのアンケート回答）」から校名を抽出 */
export function collectReviewSchoolNames(evidence: EvidenceRow[]): string[] {
  const names: string[] = [];
  for (const e of evidence) {
    if (e.kind !== 'review' || !e.section_ref) continue;
    const m = e.section_ref.match(/^(.+?)（当サイトのアンケート回答）\s*$/);
    const raw = (m ? m[1] : e.section_ref.split('（')[0] || '').trim();
    if (raw.length >= 2) names.push(raw);
  }
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

function extractQuotedSegments(bodyMd: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let i = 0;
  while (i < bodyMd.length) {
    const open = bodyMd.indexOf('「', i);
    if (open === -1) break;
    const close = bodyMd.indexOf('」', open + 1);
    if (close === -1) break;
    out.push({ start: open, end: close });
    i = close + 1;
  }
  return out;
}

function pickAttributedSchool(
  window: string,
  schoolNames: string[]
): string | null {
  for (const name of schoolNames) {
    if (name && window.includes(name)) return name;
  }
  return null;
}

/**
 * ①同一校の「」引用が3回以上ある／②校名のない「当サイトアンケート」付き引用
 */
export function analyzeProgrammaticQuoteGuards(
  bodyMd: string,
  evidence: EvidenceRow[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const schoolNames = collectReviewSchoolNames(evidence);
  if (schoolNames.length === 0) return issues;

  const segments = extractQuotedSegments(bodyMd);
  const perSchoolQuoteCount = new Map<string, number>();

  let ambiguousSurveyAttribution = 0;

  for (const { start, end } of segments) {
    const pre = bodyMd.slice(Math.max(0, start - PRE_CHARS), start);
    const post = bodyMd.slice(end + 1, Math.min(bodyMd.length, end + 1 + POST_CHARS));
    const win = `${pre}\n${post}`;

    const school = pickAttributedSchool(win, schoolNames);
    if (school) {
      perSchoolQuoteCount.set(school, (perSchoolQuoteCount.get(school) || 0) + 1);
    }

    const hasSurveyCue =
      win.includes('当サイトアンケート') ||
      win.includes('当サイト のアンケート');
    const hasArticleCue =
      win.includes('当サイト記事') ||
      win.includes('体験談') ||
      win.includes('特集');
    if (hasSurveyCue && !hasArticleCue && !school) {
      if (
        /（[^）]*(?:在校生|卒業生|保護者|回答者)[^）]*当サイトアンケート）/.test(
          post.slice(0, 100)
        ) ||
        /（当サイトアンケート）/.test(post.slice(0, 80))
      ) {
        ambiguousSurveyAttribution += 1;
      }
    }
  }

  for (const [school, n] of perSchoolQuoteCount) {
    if (n > 2) {
      issues.push({
        severity: 'error',
        message: `【自動検証】同一高校「${school}」に紐づく「」引用が${n}回あります（上限2回）。3回目以降は削除するか、根拠にある別校の口コミに差し替え、または「」を使わない要約にしてください。チェックリストの口コミ例も「」なら同一校として数えます。`,
      });
    }
  }

  if (ambiguousSurveyAttribution > 0) {
    issues.push({
      severity: 'error',
      message: `【自動検証】校名のないアンケート引用が${ambiguousSurveyAttribution}箇所あります。「」の直前約${PRE_CHARS}字・直後約${POST_CHARS}字の範囲に、根拠の正式校名（例: ◯◯高等学校）を必ず書いてください。「（在校生・当サイトアンケート）」「（当サイトアンケート）」単体は禁止です。`,
    });
  }

  return issues;
}

/** プログラム検出の error があるとき、甘い採点を抑える */
export function clampScoresForQuoteGuardErrors(
  score: { overall: number; factAccuracy: number },
  hasQuoteGuardError: boolean
): { overall: number; factAccuracy: number } {
  if (!hasQuoteGuardError) return score;
  return {
    overall: Math.min(score.overall, 52),
    factAccuracy: Math.min(score.factAccuracy, 42),
  };
}
