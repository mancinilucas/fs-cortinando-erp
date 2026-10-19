import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import {
  UserIdentity,
  UserRecord,
  UserStore,
} from '../application/user-store.js';

@Injectable()
export class PrismaUserStore implements UserStore {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async findById(id: string): Promise<UserIdentity | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
  }
}
