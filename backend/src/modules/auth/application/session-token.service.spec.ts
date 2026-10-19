import { SessionTokenService } from './session-token.service.js';

describe('SessionTokenService', () => {
  const service = new SessionTokenService();

  describe('generate', () => {
    it('returns 32 random bytes encoded as base64url', () => {
      expect(service.generate()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('generates different tokens on successive calls', () => {
      expect(service.generate()).not.toBe(service.generate());
    });
  });

  describe('hash', () => {
    it('returns the SHA-256 hex digest of the token', () => {
      expect(service.hash('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('is deterministic', () => {
      const token = 'session-token';

      expect(service.hash(token)).toBe(service.hash(token));
      expect(service.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different tokens', () => {
      expect(service.hash('token-a')).not.toBe(service.hash('token-b'));
    });
  });
});
