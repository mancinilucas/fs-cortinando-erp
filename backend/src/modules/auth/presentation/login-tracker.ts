import { normalizeIp } from '@nestjs/throttler';
import { normalizeEmail } from '../application/normalize-email.js';

export function loginTracker(request: Record<string, unknown>): string {
  const ip = typeof request.ip === 'string' ? normalizeIp(request.ip) : '';

  return `${ip}:${submittedEmail(request.body)}`;
}

function submittedEmail(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('email' in body)) {
    return '';
  }

  const email = (body as { email?: unknown }).email;

  return typeof email === 'string' ? normalizeEmail(email) : '';
}
