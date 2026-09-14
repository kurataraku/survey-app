import type { FactContextSnapshot } from '../context/types';
import type { ProposalPayloadV2 } from '../types';

const REQUEST_TIMEOUT_MS = 5_000;
const DEFINITELY_UNREACHABLE = new Set([400, 401, 403, 404, 405, 410, 422]);

export type InternalLinkReachabilityCheck = {
  url: string;
  reachable: boolean | null;
  status: number | null;
  method: 'HEAD' | 'GET' | null;
  error: string | null;
};

export type InternalLinkReachability = {
  checked: boolean;
  reachable: boolean | null;
  checks: InternalLinkReachabilityCheck[];
};

async function request(
  url: string,
  method: 'HEAD' | 'GET'
): Promise<Response> {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
  });
  if (method === 'GET') void response.body?.cancel();
  return response;
}

async function checkOne(url: string): Promise<InternalLinkReachabilityCheck> {
  let head: Response | null = null;
  try {
    head = await request(url, 'HEAD');
    if (head.status >= 200 && head.status < 300) {
      return { url, reachable: true, status: head.status, method: 'HEAD', error: null };
    }
    if (head.status === 404 || head.status === 410) {
      return { url, reachable: false, status: head.status, method: 'HEAD', error: null };
    }
  } catch {
    // HEAD非対応・一時的失敗の場合はGETで再確認する。
  }

  try {
    const get = await request(url, 'GET');
    if (get.status >= 200 && get.status < 300) {
      return { url, reachable: true, status: get.status, method: 'GET', error: null };
    }
    if (DEFINITELY_UNREACHABLE.has(get.status)) {
      return { url, reachable: false, status: get.status, method: 'GET', error: null };
    }
    return {
      url,
      reachable: null,
      status: get.status,
      method: 'GET',
      error: `一時的または判定不能なHTTP statusです: ${get.status}`,
    };
  } catch (error) {
    return {
      url,
      reachable: null,
      status: head?.status ?? null,
      method: head ? 'HEAD' : null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * same-originを確認できたリンクだけを外部取得し、SSRF範囲を対象サイト内に限定する。
 * 404/410等の確定的な不達だけをblockし、timeout/5xxは判定不能として再試行可能にする。
 */
export async function checkInternalLinkReachability(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): Promise<InternalLinkReachability> {
  if (proposal.action !== 'addApprovedInternalLink') {
    return { checked: false, reachable: null, checks: [] };
  }

  const targetOrigin = new URL(context.target.url).origin;
  const urls = proposal.targets
    .map((target) => target.proposedValue)
    .filter((value) => {
      try {
        return new URL(value).origin === targetOrigin;
      } catch {
        return false;
      }
    });
  if (urls.length !== proposal.targets.length) {
    return { checked: false, reachable: null, checks: [] };
  }

  const checks = await Promise.all(urls.map(checkOne));
  return {
    checked: true,
    reachable: checks.some((check) => check.reachable === false)
      ? false
      : checks.every((check) => check.reachable === true)
        ? true
        : null,
    checks,
  };
}
