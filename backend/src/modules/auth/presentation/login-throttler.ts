import type { ExecutionContext } from '@nestjs/common';
import { seconds, type ThrottlerOptions } from '@nestjs/throttler';
import { loginTracker } from './login-tracker.js';

// Named throttler for the per-account login limit (D35). The global throttler
// keeps its IP-based limit on every route; this one is skipped everywhere
// except AuthController.login so that both limits run together.
export const LOGIN_THROTTLER_OPTIONS = {
  name: 'login',
  ttl: seconds(60),
  limit: 5,
  getTracker: loginTracker,
  // The HTTP throttling test fails if the login route is renamed without
  // updating this identification.
  skipIf: (context: ExecutionContext): boolean =>
    context.getClass().name !== 'AuthController' ||
    context.getHandler().name !== 'login',
} satisfies ThrottlerOptions;
