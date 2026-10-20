import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/presentation/auth.guard.js';
import { GetBusinessDataQuery } from '../application/get-business-data.query.js';
import { UpdateBusinessDataUseCase } from '../application/update-business-data.use-case.js';
import { mapBusinessDataError } from './business-data-error-mapper.js';
import { BusinessDataResponseMapper } from './business-data-response.mapper.js';
import type { BusinessDataResponseDto } from './dto/business-data-response.dto.js';
import { UpdateBusinessDataDto } from './dto/update-business-data.dto.js';

// Thin HTTP layer: validation and DTO mapping only; behavior lives in the
// application use cases (D142).
@Controller('dados-do-negocio')
@UseGuards(AuthGuard)
export class DadosDoNegocioController {
  constructor(
    private readonly getBusinessData: GetBusinessDataQuery,
    private readonly updateBusinessData: UpdateBusinessDataUseCase,
  ) {}

  @Get()
  async get(): Promise<BusinessDataResponseDto> {
    return this.handle(async () =>
      BusinessDataResponseMapper.toResponse(
        await this.getBusinessData.execute(),
      ),
    );
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async update(
    @Body() dto: UpdateBusinessDataDto,
  ): Promise<BusinessDataResponseDto> {
    return this.handle(async () =>
      BusinessDataResponseMapper.toResponse(
        await this.updateBusinessData.execute({
          commercialNameOrConsultant: dto.commercialNameOrConsultant,
          phone: dto.phone,
          email: dto.email,
          taxId: dto.taxId,
        }),
      ),
    );
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      mapBusinessDataError(error);
    }
  }
}
