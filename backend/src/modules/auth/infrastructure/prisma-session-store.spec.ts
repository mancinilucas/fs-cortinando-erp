import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { SESSION_TTL_SECONDS } from '../session-ttl.js';
import { PrismaSessionStore } from './prisma-session-store.js';

const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

describe('PrismaSessionStore', () => {
  let prisma: PrismaService;
  let store: PrismaSessionStore;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    store = new PrismaSessionStore(prisma);

    const user = await prisma.user.create({
      data: {
        email: `session-store-${randomUUID()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  function newTokenHash(): string {
    return randomUUID();
  }

  it('creates a session expiring after the shared session TTL', async () => {
    const before = Date.now();

    const session = await store.create(userId, newTokenHash());

    const after = Date.now();
    expect(session.userId).toBe(userId);
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_TTL_MS,
    );
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
      after + SESSION_TTL_MS,
    );
  });

  it('persists only the token hash', async () => {
    const tokenHash = newTokenHash();

    const session = await store.create(userId, tokenHash);
    const row = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
    });

    expect(row.tokenHash).toBe(tokenHash);
    expect(Object.keys(row)).not.toContain('token');
  });

  it('finds a valid session without renewing it', async () => {
    const tokenHash = newTokenHash();
    const created = await store.create(userId, tokenHash);

    const found = await store.findValidByTokenHash(tokenHash);

    expect(found).toEqual(created);
  });

  it('returns null when the session does not exist', async () => {
    await expect(
      store.findValidByTokenHash(newTokenHash()),
    ).resolves.toBeNull();
  });

  it('rejects and lazily removes an expired session', async () => {
    const tokenHash = newTokenHash();
    const expired = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    try {
      await expect(store.findValidByTokenHash(tokenHash)).resolves.toBeNull();
      await expect(
        prisma.session.findUnique({ where: { id: expired.id } }),
      ).resolves.toBeNull();

      const logged = warnSpy.mock.calls
        .map((call) => call.map(String).join(' '))
        .join('\n');

      expect(logged).toContain('event=session_expired');
      expect(logged).not.toContain(tokenHash);
      expect(logged).not.toContain(expired.id);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('removes a session by token hash', async () => {
    const tokenHash = newTokenHash();
    const session = await store.create(userId, tokenHash);

    await store.deleteByTokenHash(tokenHash);

    await expect(
      prisma.session.findUnique({ where: { id: session.id } }),
    ).resolves.toBeNull();
  });
});
