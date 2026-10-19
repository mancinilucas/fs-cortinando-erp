import {
  assertConfiguredOrigins,
  configuredOrigins,
} from './allowed-origins.js';

function envWith(appOrigin?: string): NodeJS.ProcessEnv {
  return appOrigin === undefined ? {} : { APP_ORIGIN: appOrigin };
}

describe('configuredOrigins', () => {
  it('normalizes entries and removes duplicates', () => {
    expect(
      configuredOrigins(
        envWith(
          ' http://localhost:5173/, https://admin.example, http://localhost:5173 ',
        ),
      ),
    ).toEqual(['http://localhost:5173', 'https://admin.example']);
  });
});

describe('assertConfiguredOrigins', () => {
  it('accepts a single valid origin', () => {
    expect(() =>
      assertConfiguredOrigins(envWith('http://localhost:5173')),
    ).not.toThrow();
  });

  it('accepts a comma-separated allowlist', () => {
    expect(() =>
      assertConfiguredOrigins(
        envWith('http://localhost:5173, https://admin.example'),
      ),
    ).not.toThrow();
  });

  it('rejects a missing APP_ORIGIN', () => {
    expect(() => assertConfiguredOrigins(envWith())).toThrow(/APP_ORIGIN/);
  });

  it('rejects a whitespace-only APP_ORIGIN', () => {
    expect(() => assertConfiguredOrigins(envWith('  ,  '))).toThrow(
      /APP_ORIGIN/,
    );
  });

  it('rejects an invalid entry even when another entry is valid', () => {
    expect(() =>
      assertConfiguredOrigins(envWith('http://localhost:5173, not-an-origin')),
    ).toThrow(/APP_ORIGIN/);
  });
});
