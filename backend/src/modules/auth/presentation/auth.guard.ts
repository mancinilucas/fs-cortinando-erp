import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { clientIp } from '../../../shared/http/client-ip.js';
import { SessionStore } from '../application/session-store.js';
import { SessionTokenService } from '../application/session-token.service.js';
import { UserIdentity, UserStore } from '../application/user-store.js';
import { AUTHENTICATION_REQUIRED_MESSAGE } from './auth-error-messages.js';
import { readSessionToken } from './request-session.js';

export interface AuthenticatedRequest extends Request {
  user?: UserIdentity;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly sessions: SessionStore,
    private readonly sessionTokens: SessionTokenService,
    private readonly users: UserStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);

    if (!token) {
      this.logger.warn(`event=session_missing ip=${clientIp(request)}`);
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
    }

    const session = await this.sessions.findValidByTokenHash(
      this.sessionTokens.hash(token),
    );

    if (!session) {
      this.logger.warn(`event=session_invalid ip=${clientIp(request)}`);
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
    }

    const user = await this.users.findById(session.userId);

    if (!user) {
      this.logger.warn(`event=session_invalid ip=${clientIp(request)}`);
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE);
    }

    request.user = user;
    return true;
  }
}
