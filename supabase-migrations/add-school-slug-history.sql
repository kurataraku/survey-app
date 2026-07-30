-- 学校スラッグ変更・統合時の旧URLを301で現行URLへ引き継ぐための履歴
create table if not exists school_slug_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  old_slug text not null unique,
  reason text not null default 'manual_update',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_slug_history_school_id
  on school_slug_history(school_id);

comment on table school_slug_history is '学校ページの旧slug履歴。旧URLから現行slugへ301するために利用する。';
comment on column school_slug_history.old_slug is '過去に公開URLとして使われたslug。';
comment on column school_slug_history.reason is 'manual_update / merge など、履歴化された理由。';

alter table school_slug_history enable row level security;
