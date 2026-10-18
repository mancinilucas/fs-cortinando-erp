import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';
import { PasswordHasher } from '../application/password-hasher.js';

const ARGON2_OPTIONS = {
  // Algorithm.Argon2id. The package exposes it as an ambient const enum,
  // which is not available at runtime with isolatedModules enabled.
  algorithm: 2 as Algorithm,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
