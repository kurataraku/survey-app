import * as crypto from 'crypto';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

export function payloadHash(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}
