import { SESSION_TTL_SECONDS } from '../session-ttl.js';
import { sessionCookieName, sessionCookieOptions } from './session-cookie.js';

describe('session cookie', () => {
  it('uses the __Host- prefix and the Secure flag in production', () => {
    const env = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;

    expect(sessionCookieName(env)).toBe('__Host-cortinando_session');
    expect(sessionCookieOptions(env)).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: true,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  });

  it('omits the __Host- prefix and the Secure flag outside production', () => {
    const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;

    expect(sessionCookieName(env)).toBe('cortinando_session');
    expect(sessionCookieOptions(env)).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: false,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  });
});
