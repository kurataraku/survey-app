-- メール配信結果の追跡
-- Resend の API は送信を受け付けた時点で 200 を返すため、「送信済み」は「届いた」を意味しない。
-- 送信時にメッセージIDを記録し、あとから配信結果（delivered / bounced など）を突き合わせる。
-- 取り込み経路は cron の照合（lib/partnerships/delivery.ts）だが、将来 Webhook を足す場合も
-- 同じ applyDeliveryEvent() を呼べばよいように、ここでは経路を問わない形で持つ。

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('school_notification', 'school_invitation')),
  ref_id uuid NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'delayed', 'delivered', 'bounced', 'complained', 'canceled', 'unknown')),
  detail text,
  event_at timestamptz,
  checked_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_message_id)
);

-- 照合対象（まだ結果が確定していない送信）だけを引くための部分インデックス
CREATE INDEX IF NOT EXISTS email_deliveries_open ON public.email_deliveries(created_at)
  WHERE status IN ('queued', 'delayed');
-- 画面表示：宛先ごとの最新の結果を引く
CREATE INDEX IF NOT EXISTS email_deliveries_ref ON public.email_deliveries(kind, ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_school ON public.email_deliveries(school_id, created_at DESC);

-- service role 以外からは触らせない（ポリシーを作らないことで全拒否）
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
