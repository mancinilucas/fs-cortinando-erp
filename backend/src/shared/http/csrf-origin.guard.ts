import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { configuredOrigins, normalizeOrigin } from './allowed-origins.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = requestOrigin(request);

    if (!origin || !configuredOrigins().includes(origin)) {
      throw new ForbiddenException('Invalid origin');
    }

    return true;
  }
}

function requestOrigin(request: Request): string | null {
  const header = request.headers.origin ?? request.headers.referer;

  if (typeof header !== 'string' || header.length === 0) {
    return null;
  }

  return normalizeOrigin(header);
}
