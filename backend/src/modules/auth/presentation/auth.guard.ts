import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionStore } from '../application/session-store.js';
import { SessionTokenService } from '../application/session-token.service.js';
import { UserIdentity, UserStore } from '../application/user-store.js';
import { readSessionToken } from './request-session.js';

const GENERIC_AUTH_ERROR = 'Authentication required';

export interface AuthenticatedRequest extends Request {
  user?: UserIdentity;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionStore,
    private readonly sessionTokens: SessionTokenService,
    private readonly users: UserStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);

    if (!token) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const session = await this.sessions.findValidByTokenHash(
      this.sessionTokens.hash(token),
    );

    if (!session) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const user = await this.users.findById(session.userId);

    if (!user) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    request.user = user;
    return true;
  }
}
