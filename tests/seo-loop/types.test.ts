import { describe, expect, it } from 'vitest';
import {
  llmProposalSchema,
  proposalPayloadSchema,
  proposalPayloadV2Schema,
} from '../../lib/seo-loop/types';

const validV1Proposal = {
  action: 'updateSchoolMetaTitle',
  targets: [
    {
      type: 'school',
      id: 'school-anon-001',
      url: 'https://example.invalid/schools/alpha',
      currentValue: '現在値',
      proposedValue: '提案値',
    },
  ],
  rationale: '根拠',
  expectedImpact: '期待効果',
};

const validProposal = {
  ...validV1Proposal,
  schemaVersion: 2,
  facts: [{ source: 'gsc', statement: '表示回数が多くCTRが低い' }],
  assumptions: ['title改善で検索意図が伝わりやすくなる'],
  diagnosis: '現行titleに検索意図を表す語が不足している',
  targetMetric: 'ctr',
  confidence: 0.7,
  ruleIds: [],
  rollbackPlan: '保存済みのcurrentValueへ戻す',
  evidence: ['匿名化GSCと公開HTMLの実測値'],
};

describe('proposalPayloadSchema', () => {
  it('既存v1を受理し、evidenceの既定値を設定する', () => {
    const result = proposalPayloadSchema.parse({
      action: 'addApprovedInternalLink',
      targets: [{ type: 'url', proposedValue: '/' }],
      rationale: 'a',
      expectedImpact: 'b',
    });

    expect(result.evidence).toEqual([]);
  });

  it.each([
    ['許可外action', { ...validV1Proposal, action: 'executeSql' }],
    ['targetsが空', { ...validV1Proposal, targets: [] }],
    ['不正URL', { ...validV1Proposal, targets: [{ type: 'url', url: 'not-a-url', proposedValue: 'x' }] }],
    ['空の提案値', { ...validV1Proposal, targets: [{ type: 'school', proposedValue: '' }] }],
    ['空の根拠', { ...validV1Proposal, rationale: '' }],
  ])('%sを拒否する', (_label, value) => {
    expect(proposalPayloadSchema.safeParse(value).success).toBe(false);
  });
});

describe('proposalPayloadV2Schema', () => {
  it('actionに対応するtype・ID・URL・currentValueを必須にする', () => {
    expect(proposalPayloadV2Schema.safeParse(validProposal).success).toBe(true);
    expect(
      proposalPayloadV2Schema.safeParse({
        ...validProposal,
        targets: [{ type: 'school', url: 'https://example.invalid/schools/alpha', currentValue: 'x', proposedValue: 'y' }],
      }).success
    ).toBe(false);
    expect(
      proposalPayloadV2Schema.safeParse({
        ...validProposal,
        targets: [{ ...validProposal.targets[0], type: 'feature' }],
      }).success
    ).toBe(false);
  });

  it('confidenceを0〜1に制限し、factsを必須にする', () => {
    expect(proposalPayloadV2Schema.safeParse({ ...validProposal, confidence: 1 }).success).toBe(true);
    expect(proposalPayloadV2Schema.safeParse({ ...validProposal, confidence: 1.01 }).success).toBe(false);
    expect(proposalPayloadV2Schema.safeParse({ ...validProposal, facts: [] }).success).toBe(false);
    expect(proposalPayloadSchema.safeParse({ ...validProposal, facts: [] }).success).toBe(false);
  });
});

describe('llmProposalSchema', () => {
  it('提案5件を上限として受理する', () => {
    expect(
      llmProposalSchema.safeParse({ proposals: Array.from({ length: 5 }, () => validProposal) }).success
    ).toBe(true);
  });

  it('提案6件を拒否する', () => {
    expect(
      llmProposalSchema.safeParse({ proposals: Array.from({ length: 6 }, () => validProposal) }).success
    ).toBe(false);
  });
});
