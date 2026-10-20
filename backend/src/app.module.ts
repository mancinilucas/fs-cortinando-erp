import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { LOGIN_THROTTLER_OPTIONS } from './modules/auth/presentation/login-throttler.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { DadosDoNegocioModule } from './modules/dados-do-negocio/dados-do-negocio.module.js';
import { OrcamentosModule } from './modules/orcamentos/orcamentos.module.js';
import { PrismaModule } from './shared/database/prisma.module.js';
import { CsrfOriginGuard } from './shared/http/csrf-origin.guard.js';
import { LoggingThrottlerGuard } from './shared/http/logging-throttler.guard.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: seconds(60), limit: 60 },
      LOGIN_THROTTLER_OPTIONS,
    ]),
    PrismaModule,
    AuthModule,
    ClientesModule,
    DadosDoNegocioModule,
    OrcamentosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: CsrfOriginGuard },
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
  ],
})
export class AppModule {}
