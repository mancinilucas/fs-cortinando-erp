import type { Request } from 'express';
import { sessionCookieName } from './session-cookie.js';

// A session token is 32 CSPRNG bytes encoded as base64url (43 characters).
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookieName = sessionCookieName();

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();

    if (name !== cookieName) {
      continue;
    }

    const token = part.slice(separator + 1).trim();
    return SESSION_TOKEN_PATTERN.test(token) ? token : null;
  }

  return null;
}
