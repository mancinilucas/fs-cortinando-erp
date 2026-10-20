import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CreateCustomerUseCase } from './application/create-customer.use-case.js';
import { DeleteCustomerUseCase } from './application/delete-customer.use-case.js';
import { GetCustomerUseCase } from './application/get-customer.use-case.js';
import { SearchCustomersQuery } from './application/search-customers.query.js';
import { UpdateCustomerUseCase } from './application/update-customer.use-case.js';
import { CustomerRepository } from './domain/repositories/customer.repository.js';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository.js';
import { PrismaSearchCustomersQuery } from './infrastructure/prisma-search-customers.query.js';
import { ClientesController } from './presentation/clientes.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ClientesController],
  providers: [
    { provide: CustomerRepository, useClass: PrismaCustomerRepository },
    { provide: SearchCustomersQuery, useClass: PrismaSearchCustomersQuery },
    CreateCustomerUseCase,
    GetCustomerUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
  ],
})
export class ClientesModule {}
