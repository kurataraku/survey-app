import * as fs from 'fs';
import * as crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function readServiceAccountKey(): ServiceAccountKey {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GSC_SERVICE_ACCOUNT_KEY_JSON;

  if (!keyPath && !keyJson) {
    throw new Error(
      'GSC_SERVICE_ACCOUNT_KEY_PATH または GSC_SERVICE_ACCOUNT_KEY_JSON が未設定です'
    );
  }

  const raw = keyJson ?? fs.readFileSync(keyPath!, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GSC Service Account JSON に client_email / private_key がありません');
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri,
  };
}

function createJwt(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: READONLY_SCOPE,
    aud: key.token_uri ?? TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(key.private_key);

  return `${signingInput}.${base64Url(signature)}`;
}

export async function getGscAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const key = readServiceAccountKey();
  const assertion = createJwt(key);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(key.token_uri ?? TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC OAuth token 取得に失敗しました: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('GSC OAuth token レスポンスに access_token がありません');
  }

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}
