import type { Request } from 'express';
import { readSessionToken } from './request-session.js';
import { sessionCookieName } from './session-cookie.js';

const VALID_TOKEN = 'a'.repeat(43);

function requestWith(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as Request;
}

describe('readSessionToken', () => {
  it('returns null when the cookie header is absent', () => {
    expect(readSessionToken(requestWith())).toBeNull();
  });

  it('reads the session cookie among other cookies', () => {
    const request = requestWith(
      `theme=dark; ${sessionCookieName()}=${VALID_TOKEN}; locale=pt-BR`,
    );

    expect(readSessionToken(request)).toBe(VALID_TOKEN);
  });

  it('returns null when the session cookie is absent', () => {
    expect(readSessionToken(requestWith('theme=dark'))).toBeNull();
  });

  it('rejects a token with an invalid length', () => {
    expect(
      readSessionToken(requestWith(`${sessionCookieName()}=short`)),
    ).toBeNull();
  });

  it('rejects a token with invalid characters', () => {
    const invalidToken = `${'a'.repeat(42)}!`;

    expect(
      readSessionToken(requestWith(`${sessionCookieName()}=${invalidToken}`)),
    ).toBeNull();
  });

  it('rejects an empty session cookie', () => {
    expect(readSessionToken(requestWith(`${sessionCookieName()}=`))).toBeNull();
  });
});
