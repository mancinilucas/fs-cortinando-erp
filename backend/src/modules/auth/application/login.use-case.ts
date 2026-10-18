import { Injectable } from '@nestjs/common';
import { normalizeEmail } from './normalize-email.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionStore } from './session-store.js';
import { SessionTokenService } from './session-token.service.js';
import { UserStore } from './user-store.js';

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

    if (!user) {
      return null;
    }

    const passwordMatches = await this.passwordHasher.verify(
      user.passwordHash,
      command.password,
    );

    if (!passwordMatches) {
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
