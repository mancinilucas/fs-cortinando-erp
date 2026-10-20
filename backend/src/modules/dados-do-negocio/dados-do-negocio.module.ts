import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { BusinessDataStore } from './application/business-data-store.js';
import { GetBusinessDataQuery } from './application/get-business-data.query.js';
import { UpdateBusinessDataUseCase } from './application/update-business-data.use-case.js';
import { PrismaBusinessDataStore } from './infrastructure/prisma-business-data.store.js';
import { DadosDoNegocioController } from './presentation/dados-do-negocio.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DadosDoNegocioController],
  providers: [
    { provide: BusinessDataStore, useClass: PrismaBusinessDataStore },
    GetBusinessDataQuery,
    UpdateBusinessDataUseCase,
  ],
})
export class DadosDoNegocioModule {}
