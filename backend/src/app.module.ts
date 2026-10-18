import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PrismaModule } from './shared/database/prisma.module.js';
import { CsrfOriginGuard } from './shared/http/csrf-origin.guard.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: CsrfOriginGuard }],
})
export class AppModule {}
