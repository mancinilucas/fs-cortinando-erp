import type { Request } from 'express';

// Technical log context only: never derived from credentials or session data.
export function clientIp(request: Request): string {
  return request.ip ?? 'unknown';
}
