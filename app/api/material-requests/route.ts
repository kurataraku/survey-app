import { createHmac } from 'node:crypto';
import { after, NextRequest } from 'next/server';
import { sendApplicantReceipt } from '@/lib/partnerships/notifications';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { consentText, consentVersion, requestSchema } from '@/lib/partnerships/model';
import { isSameOrigin, json } from '@/lib/partnerships/server';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: '送信元を確認できません。' }, 403);
  const input = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    const phoneOrPostal = parsed.error.issues.find((issue) => issue.path[0] === 'phone' || issue.path[0] === 'postal_code');
    return json({ error: phoneOrPostal?.message ?? '入力内容と同意欄を確認してください。' }, 400);
  }

  const data = parsed.data;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return json({ error: '現在、資料請求を受け付けられません。' }, 503);
  const ip = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const sourceHash = createHmac('sha256', key).update(`school-material-request:${ip}`).digest('hex');
  const db = createAdminSupabaseClient();
  const result = await db.rpc('submit_school_material_request', {
    p_school_id: data.school_id,
    p_submission_key: data.submission_key,
    p_recipient_label: data.recipient_label,
    p_recipient_name: data.recipient_name,
    p_addressee: data.addressee,
    p_postal_code: data.postal_code,
    p_address: data.address,
    p_email: data.email,
    p_phone: data.phone || null,
    p_applicant_role: data.applicant_role,
    p_consent_version: consentVersion,
    p_consent_text: consentText(data.recipient_label, data.recipient_name, Boolean(data.phone)),
    p_source_hash: sourceHash,
  });
  if (!result.error) {
    // 新規受付のときだけ、応募者へ受付確認を送る（同じ請求の再送信では送らない）。
    // 応答を待たせないよう after() で送り、失敗しても受付結果には影響させない。
    if (result.data.created) {
      after(async () => {
        try {
          const school = await db.from('schools').select('name').eq('id', data.school_id).single();
          if (school.error || !school.data?.name) return;
          await sendApplicantReceipt(db, { requestId: result.data.id, email: data.email, schoolId: data.school_id, schoolName: school.data.name });
        } catch (error) {
          console.error('[Material requests] Receipt mail failed', error instanceof Error ? error.message : 'unknown');
        }
      });
    }
    return json({ id: result.data.id }, result.data.created ? 201 : 200);
  }

  switch (result.error.message) {
    case 'request_unavailable':
      return json({ error: 'この学校の資料請求受付は停止しています。' }, 409);
    case 'consent_changed':
      return json({ error: '提供先が更新されました。ページを再読み込みしてご確認ください。' }, 409);
    case 'submission_conflict':
      return json({ error: '入力内容が変わりました。ページを開き直して受付状況をご確認ください。' }, 409);
    case 'request_rate_limited':
      return json({ error: '送信が集中しています。時間をおいてお試しください。' }, 429);
    default:
      console.error('[Material requests] Insert failed', result.error.code);
      return json({ error: '受付できませんでした。時間をおいて再度お試しください。' }, 503);
  }
}
