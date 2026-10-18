import type { CookieOptions } from 'express';

export const SESSION_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}
