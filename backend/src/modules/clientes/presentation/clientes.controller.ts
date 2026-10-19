import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/presentation/auth.guard.js';
import { CreateCustomerUseCase } from '../application/create-customer.use-case.js';
import { DeleteCustomerUseCase } from '../application/delete-customer.use-case.js';
import { GetCustomerUseCase } from '../application/get-customer.use-case.js';
import { SearchCustomersQuery } from '../application/search-customers.query.js';
import { UpdateCustomerUseCase } from '../application/update-customer.use-case.js';
import { mapCustomerError } from './customer-error-mapper.js';
import { CustomerResponseMapper } from './customer-response.mapper.js';
import type { CustomerDetailResponseDto } from './dto/customer-detail-response.dto.js';
import type { CustomerSummaryResponseDto } from './dto/customer-summary-response.dto.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { SearchCustomersQueryDto } from './dto/search-customers-query.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

// Thin HTTP layer: validation and DTO mapping only; behavior lives in the
// application use cases (D66/D67).
@Controller('clientes')
@UseGuards(AuthGuard)
export class ClientesController {
  constructor(
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly getCustomer: GetCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly deleteCustomer: DeleteCustomerUseCase,
    private readonly searchCustomers: SearchCustomersQuery,
  ) {}

  @Get()
  async search(
    @Query() query: SearchCustomersQueryDto,
  ): Promise<CustomerSummaryResponseDto[]> {
    const summaries = await this.handle(() =>
      this.searchCustomers.execute(query.search),
    );

    return summaries.map((summary) =>
      CustomerResponseMapper.toSummary(summary),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerDetailResponseDto> {
    return this.handle(async () => {
      const created = await this.createCustomer.execute({
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        taxId: dto.taxId,
        address: dto.address,
        notes: dto.notes,
      });

      // Re-read so the response exposes persistence-managed timestamps (D74).
      return CustomerResponseMapper.toDetail(
        await this.getCustomer.execute(created.id),
      );
    });
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerDetailResponseDto> {
    const customer = await this.handle(() => this.getCustomer.execute(id));

    return CustomerResponseMapper.toDetail(customer);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDetailResponseDto> {
    return this.handle(async () => {
      await this.updateCustomer.execute(id, {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        taxId: dto.taxId,
        address: dto.address,
        notes: dto.notes,
      });

      // Re-read so the response exposes the new persistence-managed updatedAt.
      return CustomerResponseMapper.toDetail(
        await this.getCustomer.execute(id),
      );
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.handle(() => this.deleteCustomer.execute(id));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      mapCustomerError(error);
    }
  }
}
