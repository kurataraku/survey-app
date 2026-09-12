import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase-migrations',
    'add-seo-loop-shadow-rollouts.sql'
  ),
  'utf8'
);

describe('Unit 9 shadow rollout migration', () => {
  it('shadowログをproposal/approvalとは別テーブルへ保存する', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS seo_rulebook_rollouts');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS seo_rulebook_shadow_evaluations'
    );
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS seo_rulebook_rollout_metric_snapshots'
    );
    expect(sql).not.toMatch(
      /INSERT INTO seo_approvals[\s\S]*seo_rulebook_shadow_evaluations/
    );
  });

  it('第二承認ではactive版を変更せずshadowingへ遷移する', () => {
    const approveFunction = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION approve_seo_rule_patch'),
      sql.indexOf('CREATE OR REPLACE FUNCTION promote_seo_rulebook_rollout')
    );
    expect(approveFunction).toContain(
      "SET status = 'shadowing'"
    );
    expect(approveFunction).toContain("'status','shadowing'");
    expect(approveFunction).not.toContain(
      "SET status = 'retired'"
    );
    expect(approveFunction).not.toContain(
      "INSERT INTO seo_rulebook_versions"
    );
  });

  it('昇格はready・eligible・version/hash固定を再検証する', () => {
    const promoteFunction = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION promote_seo_rulebook_rollout'),
      sql.indexOf('CREATE OR REPLACE FUNCTION reject_seo_rulebook_rollout')
    );
    expect(promoteFunction).toContain("v_rollout.status <> 'ready'");
    expect(promoteFunction).toContain(
      "(v_rollout.metrics->>'eligible')::BOOLEAN"
    );
    expect(promoteFunction).toContain(
      'candidate_version = p_candidate_version'
    );
    expect(promoteFunction).toContain('patch_hash = p_patch_hash');
    expect(promoteFunction).toContain(
      'shadow_content_hash = p_shadow_content_hash'
    );
    expect(promoteFunction).toContain('metrics_hash = p_metrics_hash');
    expect(promoteFunction).toContain("SET status = 'retired'");
    expect(promoteFunction).toContain("'active'");
  });

  it('同時に進行できるrolloutを1件へ制限する', () => {
    expect(sql).toContain('idx_seo_rulebook_one_open_rollout');
    expect(sql).toContain("WHERE status IN ('shadowing','ready')");
    expect(sql).toContain(
      "pg_advisory_xact_lock(hashtext('seo_rulebook_shadow_rollout'))"
    );
  });
});
