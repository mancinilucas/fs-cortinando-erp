import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIp } from '../../../shared/http/client-ip.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { LogoutUseCase } from '../application/logout.use-case.js';
import type { UserIdentity } from '../application/user-store.js';
import { INVALID_CREDENTIALS_MESSAGE } from './auth-error-messages.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { LoginDto } from './login.dto.js';
import { readSessionToken } from './request-session.js';
import { sessionCookieName, sessionCookieOptions } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(dto);

    if (!result) {
      // Same log for an unknown email and a wrong password: the failure
      // never reveals which condition occurred (D38).
      this.logger.warn(`event=login_failed ip=${clientIp(request)}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    res.cookie(sessionCookieName(), result.token, sessionCookieOptions());

    return result.user;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest): UserIdentity {
    return request.user!;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute(readSessionToken(request));

    // Express clearCookie() drops maxAge, but D32 requires Max-Age=0.
    res.cookie(sessionCookieName(), '', {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
  }
}
