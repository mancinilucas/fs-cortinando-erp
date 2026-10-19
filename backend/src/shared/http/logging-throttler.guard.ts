import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from './client-ip.js';

// The default throttler message exposes the library name; blocked requests
// receive a generic message and produce a log entry with safe context only.
// `throttlerLimitDetail.key` and `.tracker` are never logged because the login
// tracker contains the submitted email (D35).
const RATE_LIMITED_MESSAGE = 'Too Many Requests';

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();

    this.logger.warn(
      `event=rate_limited method=${request.method} path=${request.path} ip=${clientIp(request)} limit=${throttlerLimitDetail.limit}`,
    );

    throw new ThrottlerException(RATE_LIMITED_MESSAGE);
  }
}
