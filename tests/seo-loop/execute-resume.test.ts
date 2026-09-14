import { describe, expect, it } from 'vitest';
import { nextRunStateAfterExecute } from '../../lib/seo-loop/orchestrator';

describe('nextRunStateAfterExecute', () => {
  it('承認待ちが残っていればpending_approvalへ戻す', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 2,
        openIssues: 5,
        remainingBudget: 4,
      })
    ).toBe('pending_approval');
  });

  it('承認後でも未分析課題と予算が残ればanalyzingへ戻す', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 5,
        remainingBudget: 4,
      })
    ).toBe('analyzing');
  });

  it('課題または予算が尽きていればcompletedにする', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 0,
        remainingBudget: 4,
      })
    ).toBe('completed');
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 5,
        remainingBudget: 0,
      })
    ).toBe('completed');
  });
});
