import type { CookieOptions } from 'express';
import { SESSION_TTL_SECONDS } from '../session-ttl.js';

export function sessionCookieName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.NODE_ENV === 'production'
    ? '__Host-cortinando_session'
    : 'cortinando_session';
}

export function sessionCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  const secure = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure,
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}
