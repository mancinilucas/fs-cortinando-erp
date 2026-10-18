import { Injectable } from '@nestjs/common';
import { SessionStore } from './session-store.js';
import { SessionTokenService } from './session-token.service.js';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: SessionStore,
    private readonly sessionTokens: SessionTokenService,
  ) {}

  async execute(token: string | null): Promise<void> {
    if (!token) {
      return;
    }

    await this.sessions.deleteByTokenHash(this.sessionTokens.hash(token));
  }
}
