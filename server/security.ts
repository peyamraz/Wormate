import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

export class TokenBucket {
  private tokens: number;
  private updated: number;
  constructor(readonly capacity: number, readonly perSecond: number, now = performance.now()) {
    this.tokens = capacity;
    this.updated = now;
  }
  take(now = performance.now()) {
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.updated) / 1000 * this.perSecond);
    this.updated = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}

export function allowedOrigins(raw: string, production: boolean) {
  const result = new Set<string>();
  for (const item of raw.split(',').map(value => value.trim()).filter(Boolean)) {
    const url = new URL(item);
    if (url.origin !== item || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('ALLOWED_ORIGINS must contain exact origins without paths.');
    if (production && url.protocol !== 'https:') throw new Error('Production origins must use HTTPS.');
    result.add(url.origin);
  }
  if (!result.size) throw new Error('An explicit ALLOWED_ORIGINS allowlist is required.');
  return result;
}

export function clientAddress(request: IncomingMessage, trustedProxies: Set<string>) {
  const remote = request.socket.remoteAddress ?? 'unknown';
  const forwarded = request.headers['x-forwarded-for'];
  // Only explicitly trusted proxies may provide a single, overwritten client IP.
  if (trustedProxies.has(remote) && typeof forwarded === 'string' && isIP(forwarded.trim())) return forwarded.trim();
  return remote;
}