import type { FactContextSnapshot } from './context/types';
import type { ProposalPayloadV2, TypedAction } from './types';

/** 見出し・箇条書き構造を持つ本文を扱うaction */
const STRUCTURED_TEXT_ACTIONS: ReadonlySet<TypedAction> = new Set([
  'updateSeoSummary',
]);

/** SERPに出る短文を扱うaction。短縮自体は表示幅調整として正当になりうる */
const SHORT_TEXT_ACTIONS: ReadonlySet<TypedAction> = new Set([
  'updateSchoolMetaTitle',
  'updateFeatureMetaDescription',
]);

/** 本文変更で残すべき最小文字数比率。これを下回る短縮は情報削減として扱う */
export const STRUCTURED_TEXT_MIN_RETAINED_RATIO = 0.8;

export type TextChangeSummary = {
  currentLength: number;
  proposedLength: number;
  retainedRatio: number;
  removedHeadings: string[];
  addedHeadings: string[];
  removedBulletCount: number;
  addedBulletCount: number;
  removedLineCount: number;
  addedLineCount: number;
};

function meaningfulLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function headings(value: string): string[] {
  return meaningfulLines(value)
    .filter((line) => /^#{1,6}\s+/u.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/u, '').trim());
}

function bullets(value: string): string[] {
  return meaningfulLines(value)
    .filter((line) => /^[-・*]\s+/u.test(line))
    .map((line) => line.replace(/^[-・*]\s+/u, '').trim());
}

function onlyIn(before: string[], after: string[]): string[] {
  const remaining = new Set(after);
  return [...new Set(before.filter((item) => !remaining.has(item)))];
}

export function summarizeTextChange(
  currentValue: string,
  proposedValue: string
): TextChangeSummary {
  const currentLength = currentValue.trim().length;
  const proposedLength = proposedValue.trim().length;
  const currentBullets = bullets(currentValue);
  const proposedBullets = bullets(proposedValue);

  return {
    currentLength,
    proposedLength,
    retainedRatio: currentLength === 0 ? 1 : proposedLength / currentLength,
    removedHeadings: onlyIn(headings(currentValue), headings(proposedValue)),
    addedHeadings: onlyIn(headings(proposedValue), headings(currentValue)),
    removedBulletCount: onlyIn(currentBullets, proposedBullets).length,
    addedBulletCount: onlyIn(proposedBullets, currentBullets).length,
    removedLineCount: onlyIn(
      meaningfulLines(currentValue),
      meaningfulLines(proposedValue)
    ).length,
    addedLineCount: onlyIn(
      meaningfulLines(proposedValue),
      meaningfulLines(currentValue)
    ).length,
  };
}

/**
 * 既存の見出し・箇条書き・情報量を落とす本文変更を検出する。
 * 「短くする」こと自体はSEO改善の根拠にならないため、情報削減は理由なしに許可しない。
 */
export function structuredTextRegressions(
  currentValue: string,
  proposedValue: string
): string[] {
  const change = summarizeTextChange(currentValue, proposedValue);
  const regressions: string[] = [];

  if (change.removedHeadings.length > 0) {
    regressions.push(
      `既存の見出しを削除しています: ${change.removedHeadings.join(' / ')}`
    );
  }
  const lostBullets = change.removedBulletCount - change.addedBulletCount;
  if (lostBullets > 0) {
    regressions.push(`既存の箇条書きが${lostBullets}件減っています`);
  }
  if (change.retainedRatio < STRUCTURED_TEXT_MIN_RETAINED_RATIO) {
    regressions.push(
      `本文を${change.currentLength}文字から${change.proposedLength}文字へ短縮しています。短文化自体はSEO改善の根拠になりません`
    );
  }
  return regressions;
}

export function normalizedLinkKey(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

/** 既存内部リンクと同じURL、または対象ページ自身へのリンク追加を検出する */
export function internalLinkRegressions(
  proposedValue: string,
  context: FactContextSnapshot
): string[] {
  const proposedKey = normalizedLinkKey(proposedValue);
  if (proposedKey === null) return ['追加リンク先URLが不正です'];

  const regressions: string[] = [];
  const existingKeys = new Set(
    context.html.internalLinks
      .map((link) => normalizedLinkKey(link))
      .filter((key): key is string => key !== null)
  );
  if (existingKeys.has(proposedKey)) {
    regressions.push(
      `対象ページには既に同じ内部リンクがあります: ${proposedValue}`
    );
  }
  if (normalizedLinkKey(context.target.url) === proposedKey) {
    regressions.push('対象ページ自身へのリンク追加は効果がありません');
  }
  return regressions;
}

/**
 * 対象ページの実測値に対して、情報価値を落とす変更・重複変更を検出する。
 * 生成時のretry、改訂時の検証、承認直前のHard Gateで共通利用する。
 */
export function contentChangeRegressions(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string[] {
  const regressions = proposal.targets.flatMap((target) => {
    if (proposal.action === 'addApprovedInternalLink') {
      return internalLinkRegressions(target.proposedValue, context);
    }
    if (STRUCTURED_TEXT_ACTIONS.has(proposal.action)) {
      return structuredTextRegressions(target.currentValue, target.proposedValue);
    }
    return [];
  });
  return [...new Set(regressions)];
}

/**
 * 生成時のretry対象にする変更退行。
 * 機械判定できる構造退行・情報価値のない案はSlackへ流す前に再生成する。
 */
export function retryableContentChangeRegressions(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string[] {
  const regressions =
    proposal.action === 'addApprovedInternalLink'
      ? proposal.targets.flatMap((target) =>
          internalLinkRegressions(target.proposedValue, context)
        )
      : [];
  const lowValue = lowValueChangeFindings(proposal)
    .filter((finding) => isSevereLowValueFlag(finding.flag))
    .map((finding) => finding.message);
  return [...new Set([...regressions, ...lowValue])];
}

export function isStructuredTextAction(action: TypedAction): boolean {
  return STRUCTURED_TEXT_ACTIONS.has(action);
}

export type LowValueChangeFlag =
  | 'paraphrase_only'
  | 'shortened_without_addition'
  | 'structure_flattened'
  | 'concrete_axis_removed'
  | 'no_new_query_term';

export type LowValueChangeFinding = {
  flag: LowValueChangeFlag;
  message: string;
};

/** 変更そのものに情報価値がないと機械判定できるフラグ */
const SEVERE_LOW_VALUE_FLAGS: ReadonlySet<LowValueChangeFlag> = new Set([
  'paraphrase_only',
  'shortened_without_addition',
  'structure_flattened',
  'concrete_axis_removed',
  'no_new_query_term',
]);

/** 言い換え判定の上限。これ未満の文字数変化は情報量が変わっていないとみなす */
const PARAPHRASE_CHANGE_RATE = 0.05;
/** 短文actionで意図的な短縮とみなす下限比率 */
const SHORT_TEXT_SHORTENING_RATIO = 0.9;
/** 短文actionで情報追加とみなすのに必要な実質文字数 */
const SHORT_TEXT_MIN_ADDED_LENGTH = 2;

const LINE_BREAK_TAG = /<br\s*\/?>/iu;

/** 「充実」「多様」等で具体性があるように見せるだけの販促的な一般表現 */
const GENERIC_PROMOTIONAL_PHRASES =
  /多様な学び|柔軟な学び|充実したサポート(?:体制)?|手厚いサポート(?:体制)?|サポート体制|学校の魅力|魅力を(?:紹介|解説)/gu;

/** 通信制高校の検索者が比較判断に使う具体軸 */
const CONCRETE_AXIS_TERMS = [
  '学費',
  '費用',
  'コース',
  '通学',
  '登校',
  'スクーリング',
  'サポート',
  '進路',
  '就職',
  '大学進学',
  '単位',
  'レポート',
  '制服',
  '校則',
  '不登校',
  'メンタル',
  '行事',
  '雰囲気',
  '学校生活',
  '学習環境',
] as const;

function concreteAxes(value: string): Set<string> {
  const concreteText = value.replace(GENERIC_PROMOTIONAL_PHRASES, '');
  return new Set(
    CONCRETE_AXIS_TERMS.filter((term) => concreteText.includes(term))
  );
}

/** title/descriptionで情報量を増やさない一般語 */
const GENERIC_FILLER_WORDS = [
  'について',
  'おすすめ',
  'チェック',
  'ガイド',
  'サイト',
  'ページ',
  '一覧',
  'まとめ',
  '紹介',
  '解説',
  '提供',
  '詳細',
  '詳しく',
  '特集',
  '情報',
  '学校',
  '人気',
  '最新',
  '徹底',
  '充実',
  '多様',
  '柔軟',
  '魅力',
  '体制',
  '学び',
  '掲載',
  '公開',
  '一挙',
];

/**
 * 既出の固有名詞を並べ直しただけに見せるためのラベル語。
 * 「地域別」など、軸名だけ足して中身が増えない変更を除外する。
 */
const FRAMING_LABEL_WORDS = [
  '地域別',
  '種類別',
  '目的別',
  '条件別',
  '項目別',
  'タイプ別',
  '分野別',
  '年代別',
  '学年別',
  'コース別',
  '方式別',
  '形式別',
];

const FUNCTION_CHARS = /[はがをにでとのもやへかられますしるでだあっ]/gu;
const NON_WORD_CHARS = /[\p{P}\p{S}\s\u3000]/gu;

/** currentValueとproposedValueの共通前後を除いた、実際に差し替わった部分 */
function addedFragment(currentValue: string, proposedValue: string): string {
  const current = currentValue.trim();
  const proposed = proposedValue.trim();
  let prefix = 0;
  while (
    prefix < current.length &&
    prefix < proposed.length &&
    current[prefix] === proposed[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < current.length - prefix &&
    suffix < proposed.length - prefix &&
    current[current.length - 1 - suffix] === proposed[proposed.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return proposed.slice(prefix, proposed.length - suffix);
}

/**
 * proposedから、currentに既にある最長一致部分を除いた残り。
 * 語順入れ替え・括弧位置の移動ではほぼ空になる（単純チャンク分割より再配置に強い）。
 */
export function novelRawText(currentValue: string, proposedValue: string): string {
  const current = currentValue.trim();
  const proposed = proposedValue.trim();
  if (!proposed) return '';
  if (!current) return proposed;

  let novel = '';
  let index = 0;
  while (index < proposed.length) {
    let matchedLength = 0;
    const maxLength = proposed.length - index;
    for (let length = maxLength; length >= 2; length -= 1) {
      if (current.includes(proposed.slice(index, index + length))) {
        matchedLength = length;
        break;
      }
    }
    if (matchedLength >= 2) {
      index += matchedLength;
      continue;
    }
    novel += proposed[index]!;
    index += 1;
  }
  return novel;
}

/** currentに語幹がある「〜別」ラベルを除去する */
function stripExistingFramingLabels(text: string, currentValue: string): string {
  let cleaned = FRAMING_LABEL_WORDS.reduce(
    (value, label) => value.split(label).join(''),
    text
  );
  cleaned = cleaned.replace(/([一-龥ぁ-んァ-ヶーA-Za-z0-9]{1,8})別/gu, (full, stem: string) => {
    if (currentValue.includes(full) || currentValue.includes(stem)) return '';
    return full;
  });
  return cleaned;
}

/** 一般語・助詞・記号・既出ラベルを除いて残る文字数 */
function substantiveLength(fragment: string, currentValue = ''): number {
  const withoutFraming = stripExistingFramingLabels(fragment, currentValue);
  const withoutFillers = GENERIC_FILLER_WORDS.reduce(
    (text, word) => text.split(word).join(''),
    withoutFraming
  );
  return withoutFillers
    .replace(NON_WORD_CHARS, '')
    .replace(FUNCTION_CHARS, '').length;
}

/**
 * 短文変更の実質的な新規情報量。
 * 末尾追加はLCS断片、語順入れ替えは既出除去の方が鋭いので小さい方を採用する。
 */
export function novelSubstantiveLength(
  currentValue: string,
  proposedValue: string
): number {
  const byFragment = substantiveLength(
    addedFragment(currentValue, proposedValue),
    currentValue
  );
  const byNovelRaw = substantiveLength(
    novelRawText(currentValue, proposedValue),
    currentValue
  );
  return Math.min(byFragment, byNovelRaw);
}

/** GSC Factに含まれる検索クエリ語（単一Queryとページ上位クエリ内訳） */
function queryTerms(proposal: ProposalPayloadV2): string[] {
  const terms: string[] = [];
  for (const fact of proposal.facts) {
    if (fact.source !== 'gsc') continue;
    const matched = fact.statement.match(/^Query:\s*(.+)$/u);
    if (matched) {
      terms.push(...matched[1]!.split(/[\s\u3000]+/u));
    }
    if (/Top queries for this page/u.test(fact.statement)) {
      for (const row of fact.statement.matchAll(/"query"\s*:\s*"([^"]+)"/gu)) {
        terms.push(...row[1]!.split(/[\s\u3000]+/u));
      }
    }
  }
  return [
    ...new Set(
      terms
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    ),
  ];
}

function structuredTextFindings(
  currentValue: string,
  proposedValue: string
): LowValueChangeFinding[] {
  const change = summarizeTextChange(currentValue, proposedValue);
  const changeRate =
    change.currentLength === 0
      ? 1
      : Math.abs(change.proposedLength - change.currentLength) / change.currentLength;
  // 既存行や既存箇条書きを言い換えるだけでも追加件数は増えるため、純増だけを情報追加とみなす
  const addedNothing =
    change.addedHeadings.length === 0 &&
    change.addedBulletCount <= change.removedBulletCount &&
    change.addedLineCount <= change.removedLineCount;
  const findings: LowValueChangeFinding[] = [];

  if (addedNothing && changeRate < PARAPHRASE_CHANGE_RATE) {
    findings.push({
      flag: 'paraphrase_only',
      message: `言い換えのみの変更です（文字数変化 ${(changeRate * 100).toFixed(1)}%、見出し・箇条書きの追加なし）`,
    });
  }
  if (addedNothing && change.proposedLength < change.currentLength) {
    findings.push({
      flag: 'shortened_without_addition',
      message: '情報追加のない短縮です。短文化自体はSEO改善の根拠になりません',
    });
  }
  if (!LINE_BREAK_TAG.test(currentValue) && LINE_BREAK_TAG.test(proposedValue)) {
    findings.push({
      flag: 'structure_flattened',
      message: '<br>を持ち込んで見出し・箇条書き構造を潰しています',
    });
  } else if (
    change.removedHeadings.length > 0 ||
    change.removedBulletCount > change.addedBulletCount
  ) {
    findings.push({
      flag: 'structure_flattened',
      message: '既存の見出しまたは箇条書きを減らしています',
    });
  }
  return findings;
}

function shortTextFindings(
  currentValue: string,
  proposedValue: string
): LowValueChangeFinding[] {
  const currentAxes = concreteAxes(currentValue);
  const proposedAxes = concreteAxes(proposedValue);
  const removedAxes = [...currentAxes].filter((axis) => !proposedAxes.has(axis));
  const addedAxes = [...proposedAxes].filter((axis) => !currentAxes.has(axis));
  const findings: LowValueChangeFinding[] = [];
  if (removedAxes.length > 0 && addedAxes.length === 0) {
    findings.push({
      flag: 'concrete_axis_removed',
      message: `具体的な比較軸を一般表現へ置き換えています（削除: ${removedAxes.join(' / ')}）`,
    });
  }

  const currentLength = currentValue.trim().length;
  const proposedLength = proposedValue.trim().length;
  // SERP幅向けの大幅短縮は短文化自体を罰しない（既存テスト・運用方針）
  if (proposedLength < currentLength * SHORT_TEXT_SHORTENING_RATIO) {
    return findings;
  }

  const novelty = novelSubstantiveLength(currentValue, proposedValue);
  if (novelty < SHORT_TEXT_MIN_ADDED_LENGTH) {
    const preview =
      stripExistingFramingLabels(
        novelRawText(currentValue, proposedValue) ||
          addedFragment(currentValue, proposedValue),
        currentValue
      ).trim() || 'なし';
    findings.push({
      flag: 'paraphrase_only',
      message: `既出語の再配置・ラベル付け替えだけで情報が増えていません（新規部分: ${preview}）`,
    });
  }
  return findings;
}

/**
 * 「情報が増えていない変更」を機械判定する。
 * Soft Evalで表現品質・期待効果に上限を課すための入力にする。
 */
export function lowValueChangeFindings(
  proposal: ProposalPayloadV2
): LowValueChangeFinding[] {
  const isStructured = STRUCTURED_TEXT_ACTIONS.has(proposal.action);
  const isShortText = SHORT_TEXT_ACTIONS.has(proposal.action);
  if (!isStructured && !isShortText) return [];

  const terms = queryTerms(proposal);
  const findings = proposal.targets.flatMap((target) => {
    const perTarget = isStructured
      ? structuredTextFindings(target.currentValue, target.proposedValue)
      : shortTextFindings(target.currentValue, target.proposedValue);
    const addedQueryTerm = terms.some(
      (term) =>
        !target.currentValue.includes(term) && target.proposedValue.includes(term)
    );
    const currentAxes = concreteAxes(target.currentValue);
    const addedConcreteAxis = [...concreteAxes(target.proposedValue)].some(
      (axis) => !currentAxes.has(axis)
    );
    if (
      isShortText &&
      terms.length > 0 &&
      !addedQueryTerm &&
      !addedConcreteAxis
    ) {
      perTarget.push({
        flag: 'no_new_query_term',
        message: `対象クエリ語も具体的な比較軸も新たに含めていません（${terms.join(' / ')}）`,
      });
    }
    return perTarget;
  });

  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.message)) return false;
    seen.add(finding.message);
    return true;
  });
}

export function isSevereLowValueFlag(flag: LowValueChangeFlag): boolean {
  return SEVERE_LOW_VALUE_FLAGS.has(flag);
}

/** currentValue（`links:25:sha256:...`）から実測リンク件数を読む */
export function existingInternalLinkCount(currentValue: string): number | null {
  const matched = currentValue.match(/^links:(\d+):/u);
  return matched ? Number(matched[1]) : null;
}
