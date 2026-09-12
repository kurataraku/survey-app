import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const initialMigration = readFileSync(
  new URL(
    '../../supabase-migrations/add-seo-loop-typed-rule-patches.sql',
    import.meta.url
  ),
  'utf8'
);
const correctiveMigration = readFileSync(
  new URL(
    '../../supabase-migrations/allow-seo-loop-single-operator-rule-patch-approval.sql',
    import.meta.url
  ),
  'utf8'
);

describe('一人運用のRule Patch第二承認', () => {
  it('初回・補正migrationのどちらもfeedback提出者本人を拒否しない', () => {
    for (const migration of [initialMigration, correctiveMigration]) {
      expect(migration).not.toContain(
        'evidence submitter cannot approve rule patch'
      );
      expect(migration).not.toContain(
        'feedback.submitted_by_id = p_approver_id'
      );
    }
  });

  it('補正後もTyped Patchの安全境界をDBで再検証する', () => {
    expect(correctiveMigration).toContain(
      'count(DISTINCT issue.issue_key)'
    );
    expect(correctiveMigration).toContain(
      'insufficient independent issue keys'
    );
    expect(correctiveMigration).toContain(
      "v_candidate.status <> 'pending_approval'"
    );
    expect(correctiveMigration).toContain(
      'version = v_candidate.base_rulebook_version'
    );
    expect(correctiveMigration).toContain(
      'content_hash = v_candidate.base_rulebook_hash'
    );
    expect(correctiveMigration).toContain('unsafe title max patch');
    expect(correctiveMigration).toContain('unsafe description max patch');
    expect(correctiveMigration).toContain('unsafe soft score patch');
    expect(correctiveMigration).toContain(
      'proposed rulebook content mismatch'
    );
  });

  it('補正RPCをPUBLICから剥奪しservice_roleだけへ許可する', () => {
    expect(correctiveMigration).toMatch(
      /REVOKE ALL ON FUNCTION create_seo_rule_patch_candidate_v2[\s\S]+FROM PUBLIC/
    );
    expect(correctiveMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION create_seo_rule_patch_candidate_v2[\s\S]+TO service_role/
    );
    expect(correctiveMigration).toMatch(
      /REVOKE ALL ON FUNCTION approve_seo_rule_patch[\s\S]+FROM PUBLIC/
    );
    expect(correctiveMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION approve_seo_rule_patch[\s\S]+TO service_role/
    );
  });
});
