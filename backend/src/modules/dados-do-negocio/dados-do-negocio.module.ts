import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../shared/database/prisma.module.js';

@Module({
  imports: [AuthModule, PrismaModule],
})
export class DadosDoNegocioModule {}
