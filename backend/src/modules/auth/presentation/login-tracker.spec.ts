import { loginTracker } from './login-tracker.js';

describe('loginTracker', () => {
  it('combines the normalized ip and email', () => {
    expect(
      loginTracker({
        ip: '203.0.113.10',
        body: { email: '  ADMIN@Example.COM ' },
      }),
    ).toBe('203.0.113.10:admin@example.com');
  });

  it('uses an empty email when the body has none', () => {
    expect(loginTracker({ ip: '203.0.113.10' })).toBe('203.0.113.10:');
    expect(loginTracker({ ip: '203.0.113.10', body: {} })).toBe(
      '203.0.113.10:',
    );
  });

  it('separates different emails from the same ip', () => {
    const first = loginTracker({
      ip: '203.0.113.10',
      body: { email: 'first@example.com' },
    });
    const second = loginTracker({
      ip: '203.0.113.10',
      body: { email: 'second@example.com' },
    });

    expect(first).not.toBe(second);
  });

  it('normalizes ipv6 addresses', () => {
    expect(loginTracker({ ip: '::1' })).toBe('::1:');
  });
});
