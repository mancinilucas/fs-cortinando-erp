import { Module } from '@nestjs/common';
import { PasswordHasher } from './application/password-hasher.js';
import { SessionTokenService } from './application/session-token.service.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';

@Module({
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    SessionTokenService,
  ],
})
export class AuthModule {}
