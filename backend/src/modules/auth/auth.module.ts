import { Module } from '@nestjs/common';
import { PasswordHasher } from './application/password-hasher.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';

@Module({
  providers: [{ provide: PasswordHasher, useClass: Argon2PasswordHasher }],
})
export class AuthModule {}
