import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();
  const password = 'correct horse battery staple';

  it('produces an Argon2id PHC hash distinct from the plaintext', async () => {
    const passwordHash = await hasher.hash(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('verifies the correct password', async () => {
    const passwordHash = await hasher.hash(password);

    await expect(hasher.verify(passwordHash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await hasher.hash(password);

    await expect(hasher.verify(passwordHash, 'wrong password')).resolves.toBe(
      false,
    );
  });

  it('generates a different hash for the same password', async () => {
    const firstHash = await hasher.hash(password);
    const secondHash = await hasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it('returns false for a malformed hash', async () => {
    await expect(hasher.verify('not-a-hash', password)).resolves.toBe(false);
  });
});
