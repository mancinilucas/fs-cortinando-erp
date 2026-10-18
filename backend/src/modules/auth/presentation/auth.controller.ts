import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { LoginUseCase } from '../application/login.use-case.js';
import { LoginDto } from './login.dto.js';
import { sessionCookieName, sessionCookieOptions } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(dto);

    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }

    res.cookie(sessionCookieName(), result.token, sessionCookieOptions());

    return result.user;
  }
}
