import { Injectable } from '@nestjs/common';
import { normalizeEmail } from './normalize-email.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionStore } from './session-store.js';
import { SessionTokenService } from './session-token.service.js';
import { UserStore } from './user-store.js';

// Argon2id hash of a random value using the parameters approved in D26.
// It is verified when the email does not exist so that both failure paths
// perform the same computation before returning (D38).
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ORWaS4tzjo2Mpw6uYRAppg$mKaRFUj6UwBczLQK32slEruCptYV7r7Ce0Kp64KQSIM';

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokens: SessionTokenService,
    private readonly sessions: SessionStore,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult | null> {
    const user = await this.users.findByEmail(normalizeEmail(command.email));

    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      command.password,
    );

    if (!user || !passwordMatches) {
      return null;
    }

    const token = this.sessionTokens.generate();
    await this.sessions.create(user.id, this.sessionTokens.hash(token));

    return {
      token,
      user: { id: user.id, email: user.email },
    };
  }
}
