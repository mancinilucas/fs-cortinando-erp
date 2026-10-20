import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { LoginUseCase } from './application/login.use-case.js';
import { LogoutUseCase } from './application/logout.use-case.js';
import { PasswordHasher } from './application/password-hasher.js';
import { SessionStore } from './application/session-store.js';
import { SessionTokenService } from './application/session-token.service.js';
import { UserStore } from './application/user-store.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { PrismaSessionStore } from './infrastructure/prisma-session-store.js';
import { PrismaUserStore } from './infrastructure/prisma-user-store.js';
import { AuthController } from './presentation/auth.controller.js';
import { AuthGuard } from './presentation/auth.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: SessionStore, useClass: PrismaSessionStore },
    { provide: UserStore, useClass: PrismaUserStore },
    SessionTokenService,
    LoginUseCase,
    LogoutUseCase,
    AuthGuard,
  ],
  // SessionStore, SessionTokenService and UserStore are exported because Nest
  // resolves AuthGuard in the importing module's context (D67): the E2E run
  // showed the guard cannot be constructed in ClientesModule without them.
  exports: [AuthGuard, SessionStore, SessionTokenService, UserStore],
})
export class AuthModule {}
