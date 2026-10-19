import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { SessionRecord, SessionStore } from '../application/session-store.js';
import { SESSION_TTL_SECONDS } from '../session-ttl.js';

@Injectable()
export class PrismaSessionStore implements SessionStore {
  private readonly logger = new Logger(PrismaSessionStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, tokenHash: string): Promise<SessionRecord> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });

    return this.toRecord(session);
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      // Neither the token hash nor the session id is logged.
      this.logger.warn('event=session_expired');
      return null;
    }

    return this.toRecord(session);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  private toRecord(session: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): SessionRecord {
    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
  }
}
