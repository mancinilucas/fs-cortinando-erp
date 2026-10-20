import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, PrismaModule],
})
export class OrcamentosModule {}
