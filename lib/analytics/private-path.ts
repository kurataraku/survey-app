export function isPrivateAnalyticsPath(pathname: string) {
  return pathname.includes('/admin') || /(?:^|\/)school-portal(?:\/|$)/.test(pathname)
    || /\/schools\/[^/]+\/request\/?$/.test(pathname);
}
