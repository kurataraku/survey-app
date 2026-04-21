/**
 * QUOカードPay 法人API クライアント
 * 実際のAPI仕様は https://www.quocard.com/business/ から取得・設定してください
 */

export interface QuoCardIssueResult {
  success: boolean;
  gift_code?: string;
  error?: string;
}

export async function issueQuoCardPay(
  amount: number,
  recipientEmail: string
): Promise<QuoCardIssueResult> {
  const apiKey = process.env.QUOCARD_API_KEY;
  const apiUrl = process.env.QUOCARD_API_URL;

  if (!apiKey || !apiUrl) {
    console.warn('[quocard] API未設定のためスキップ（開発環境）');
    // 開発環境用のモックレスポンス
    return { success: true, gift_code: `MOCK-${Date.now()}` };
  }

  try {
    const res = await fetch(`${apiUrl}/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        recipient_email: recipientEmail,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, gift_code: data.gift_code };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
