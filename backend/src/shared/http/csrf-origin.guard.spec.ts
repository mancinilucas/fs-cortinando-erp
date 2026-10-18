import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfOriginGuard } from './csrf-origin.guard.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function contextFor(
  method: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfOriginGuard', () => {
  const guard = new CsrfOriginGuard();

  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ALLOWED_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s with an allowed origin',
    (method) => {
      expect(
        guard.canActivate(contextFor(method, { origin: ALLOWED_ORIGIN })),
      ).toBe(true);
    },
  );

  it('falls back to Referer when Origin is absent', () => {
    expect(
      guard.canActivate(
        contextFor('POST', { referer: `${ALLOWED_ORIGIN}/login` }),
      ),
    ).toBe(true);
  });

  it('rejects a mutating request from another origin', () => {
    expect(() =>
      guard.canActivate(contextFor('POST', { origin: 'https://evil.example' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects a mutating request without Origin and Referer', () => {
    expect(() => guard.canActivate(contextFor('POST'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an invalid Origin even when Referer matches', () => {
    expect(() =>
      guard.canActivate(
        contextFor('POST', {
          origin: 'null',
          referer: `${ALLOWED_ORIGIN}/login`,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('does not block read methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(contextFor(method))).toBe(true);
    }
  });

  it('normalizes trailing slashes', () => {
    vi.stubEnv('APP_ORIGIN', `${ALLOWED_ORIGIN}/`);

    expect(
      guard.canActivate(contextFor('POST', { origin: `${ALLOWED_ORIGIN}/` })),
    ).toBe(true);
  });

  it('accepts any origin from the configured allowlist', () => {
    vi.stubEnv('APP_ORIGIN', 'http://localhost:5173, https://admin.example');

    expect(
      guard.canActivate(
        contextFor('POST', { origin: 'https://admin.example' }),
      ),
    ).toBe(true);
  });

  it('fails closed when APP_ORIGIN is not configured', () => {
    vi.stubEnv('APP_ORIGIN', '');

    expect(() =>
      guard.canActivate(contextFor('POST', { origin: ALLOWED_ORIGIN })),
    ).toThrow(ForbiddenException);
  });
});
