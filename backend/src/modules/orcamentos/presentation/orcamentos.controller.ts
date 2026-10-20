import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/presentation/auth.guard.js';
import { GetDashboardQuery } from '../application/queries/get-dashboard.query.js';
import { GetQuoteQuery } from '../application/queries/get-quote.query.js';
import { ListCustomerQuotesQuery } from '../application/queries/list-customer-quotes.query.js';
import { ListQuoteHistoryQuery } from '../application/queries/list-quote-history.query.js';
import { SearchQuotesQuery } from '../application/queries/search-quotes.query.js';
import { CancelQuoteUseCase } from '../application/use-cases/cancel-quote.use-case.js';
import { CompleteServiceUseCase } from '../application/use-cases/complete-service.use-case.js';
import { ConfirmQuoteUseCase } from '../application/use-cases/confirm-quote.use-case.js';
import { CreateQuoteFromCustomerUseCase } from '../application/use-cases/create-quote-from-customer.use-case.js';
import { DeleteDraftQuoteUseCase } from '../application/use-cases/delete-draft-quote.use-case.js';
import { GenerateCommercialPdfUseCase } from '../application/use-cases/generate-commercial-pdf.use-case.js';
import { GenerateProductionOrderUseCase } from '../application/use-cases/generate-production-order.use-case.js';
import { MarkQuoteAsSentUseCase } from '../application/use-cases/mark-quote-as-sent.use-case.js';
import { RemoveInstallationUseCase } from '../application/use-cases/remove-installation.use-case.js';
import { RenewQuoteUseCase } from '../application/use-cases/renew-quote.use-case.js';
import { ReopenQuoteUseCase } from '../application/use-cases/reopen-quote.use-case.js';
import { ScheduleInstallationUseCase } from '../application/use-cases/schedule-installation.use-case.js';
import { StartProductionUseCase } from '../application/use-cases/start-production.use-case.js';
import { UpdateQuoteUseCase } from '../application/use-cases/update-quote.use-case.js';
import {
  CancelQuoteDto,
  RenewQuoteDto,
  ScheduleInstallationDto,
  SendQuoteDto,
} from './dto/quote-action.dto.js';
import type { DashboardResponseDto } from './dto/dashboard-response.dto.js';
import type { QuoteDetailResponseDto } from './dto/quote-detail-response.dto.js';
import type { QuoteHistoryResponseDto } from './dto/quote-history-response.dto.js';
import type { QuoteSummaryResponseDto } from './dto/quote-summary-response.dto.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { SearchQuotesQueryDto } from './dto/search-quotes-query.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { DashboardResponseMapper } from './dashboard-response.mapper.js';
import { mapQuoteError } from './quote-error-mapper.js';
import { QuoteRequestMapper } from './quote-request.mapper.js';
import { QuoteResponseMapper } from './quote-response.mapper.js';
import { buildContentDisposition } from './document-filename.js';
import { mapDocumentError } from './document-error-mapper.js';

// Thin HTTP layer (D115): route binding and DTO mapping only; all behavior is
// delegated to application use cases and queries. Every mutation returns the
// detail re-read after persistence so updatedAt is current (D115).
@Controller()
@UseGuards(AuthGuard)
export class OrcamentosController {
  constructor(
    private readonly createQuote: CreateQuoteFromCustomerUseCase,
    private readonly getQuote: GetQuoteQuery,
    private readonly getDashboard: GetDashboardQuery,
    private readonly updateQuote: UpdateQuoteUseCase,
    private readonly deleteDraftQuote: DeleteDraftQuoteUseCase,
    private readonly markAsSent: MarkQuoteAsSentUseCase,
    private readonly confirmQuote: ConfirmQuoteUseCase,
    private readonly reopenQuote: ReopenQuoteUseCase,
    private readonly renewQuote: RenewQuoteUseCase,
    private readonly cancelQuote: CancelQuoteUseCase,
    private readonly startProductionUseCase: StartProductionUseCase,
    private readonly completeService: CompleteServiceUseCase,
    private readonly scheduleInstallationUseCase: ScheduleInstallationUseCase,
    private readonly removeInstallationUseCase: RemoveInstallationUseCase,
    private readonly searchQuotes: SearchQuotesQuery,
    private readonly listCustomerQuotes: ListCustomerQuotesQuery,
    private readonly listQuoteHistory: ListQuoteHistoryQuery,
    private readonly generateCommercialPdf: GenerateCommercialPdfUseCase,
    private readonly generateProductionOrder: GenerateProductionOrderUseCase,
  ) {}

  // D239/D242: read-only projection with no query parameters, no CSRF and no
  // history entry.
  @Get('dashboard')
  async dashboard(): Promise<DashboardResponseDto> {
    const view = await this.handle(() => this.getDashboard.execute());

    return DashboardResponseMapper.toResponse(view);
  }

  @Post('clientes/:customerId/orcamentos')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateQuoteDto = {},
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      const created = await this.createQuote.execute(
        QuoteRequestMapper.toCreateInput(customerId, dto),
      );

      return this.readDetail(created.id);
    });
  }

  @Get('clientes/:customerId/orcamentos')
  async listByCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<QuoteSummaryResponseDto[]> {
    const summaries = await this.handle(() =>
      this.listCustomerQuotes.execute(customerId),
    );

    return summaries.map((summary) => QuoteResponseMapper.toSummary(summary));
  }

  @Get('orcamentos')
  async search(
    @Query() query: SearchQuotesQueryDto,
  ): Promise<QuoteSummaryResponseDto[]> {
    const summaries = await this.handle(() =>
      this.searchQuotes.execute({
        search: query.search,
        status: query.status,
      }),
    );

    return summaries.map((summary) => QuoteResponseMapper.toSummary(summary));
  }

  @Get('orcamentos/:id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(() => this.readDetail(id));
  }

  @Patch('orcamentos/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto = {},
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.updateQuote.execute(QuoteRequestMapper.toUpdateInput(id, dto));

      return this.readDetail(id);
    });
  }

  @Delete('orcamentos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.handle(() => this.deleteDraftQuote.execute({ id }));
  }

  @Post('orcamentos/:id/enviar')
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendQuoteDto = {},
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.markAsSent.execute({ id, validUntil: dto.validUntil });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/confirmar')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.confirmQuote.execute({ id });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/reabrir')
  @HttpCode(HttpStatus.OK)
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.reopenQuote.execute({ id });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/renovar')
  @HttpCode(HttpStatus.OK)
  async renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewQuoteDto,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.renewQuote.execute({ id, validUntil: dto.validUntil });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/cancelar')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelQuoteDto = {},
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.cancelQuote.execute({ id, reason: dto.reason });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/iniciar-producao')
  @HttpCode(HttpStatus.OK)
  async startProduction(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.startProductionUseCase.execute({ id });

      return this.readDetail(id);
    });
  }

  @Post('orcamentos/:id/concluir')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.completeService.execute({ id });

      return this.readDetail(id);
    });
  }

  @Put('orcamentos/:id/instalacao')
  async scheduleInstallation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleInstallationDto,
  ): Promise<QuoteDetailResponseDto> {
    return this.handle(async () => {
      await this.scheduleInstallationUseCase.execute({
        id,
        scheduledInstallationAt: dto.scheduledInstallationAt,
      });

      return this.readDetail(id);
    });
  }

  @Delete('orcamentos/:id/instalacao')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeInstallation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.handle(() => this.removeInstallationUseCase.execute({ id }));
  }

  @Get('orcamentos/:id/historico')
  async history(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteHistoryResponseDto[]> {
    const entries = await this.handle(() =>
      this.listQuoteHistory.execute({ id }),
    );

    return entries.map((entry) => QuoteResponseMapper.toHistory(entry));
  }

  // D189/D192: documents are generated on demand and streamed as bytes. The
  // quote is read first only to derive the filename from its number; the
  // document use cases return the rendered bytes.
  @Get('orcamentos/:id/pdf')
  @Header('Cache-Control', 'no-store')
  async commercialPdf(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    return this.handleDocumentFile(async () => {
      const quote = await this.getQuote.execute({ id });
      const bytes = await this.generateCommercialPdf.execute({ id });

      return {
        bytes,
        disposition: buildContentDisposition(
          'commercial-pdf',
          quote.quoteNumber,
        ),
      };
    });
  }

  @Get('orcamentos/:id/ordem-producao')
  @Header('Cache-Control', 'no-store')
  async productionOrder(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    return this.handleDocumentFile(async () => {
      const quote = await this.getQuote.execute({ id });
      const bytes = await this.generateProductionOrder.execute({ id });

      return {
        bytes,
        disposition: buildContentDisposition(
          'production-order',
          quote.quoteNumber,
        ),
      };
    });
  }

  private async handleDocumentFile(
    operation: () => Promise<{ bytes: Uint8Array; disposition: string }>,
  ): Promise<StreamableFile> {
    try {
      const { bytes, disposition } = await operation();

      return new StreamableFile(Buffer.from(bytes), {
        type: 'application/pdf',
        disposition,
        length: bytes.byteLength,
      });
    } catch (error) {
      try {
        mapDocumentError(error);
      } catch (mapped) {
        if (mapped !== error) {
          throw mapped;
        }
      }

      mapQuoteError(error);
    }
  }

  private async readDetail(id: string): Promise<QuoteDetailResponseDto> {
    return QuoteResponseMapper.toDetail(await this.getQuote.execute({ id }));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      mapQuoteError(error);
    }
  }
}
