import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { PasswordHasher } from './application/password-hasher.js';
import { SessionStore } from './application/session-store.js';
import { SessionTokenService } from './application/session-token.service.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { PrismaSessionStore } from './infrastructure/prisma-session-store.js';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: SessionStore, useClass: PrismaSessionStore },
    SessionTokenService,
  ],
})
export class AuthModule {}
