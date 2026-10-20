import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { DadosDoNegocioModule } from '../dados-do-negocio/dados-do-negocio.module.js';
import { Clock } from './application/ports/clock.port.js';
import { CustomerEligibility } from './application/ports/customer-eligibility.port.js';
import { QuoteDocumentRenderer } from './application/documents/quote-document-renderer.js';
import { QuoteHistoryQueryRepository } from './application/ports/quote-history-query.repository.js';
import { QuoteHistoryWriter } from './application/ports/quote-history-writer.port.js';
import { QuoteSearchQueryRepository } from './application/ports/quote-search-query.repository.js';
import { GetQuoteQuery } from './application/queries/get-quote.query.js';
import { ListCustomerQuotesQuery } from './application/queries/list-customer-quotes.query.js';
import { ListQuoteHistoryQuery } from './application/queries/list-quote-history.query.js';
import { SearchQuotesQuery } from './application/queries/search-quotes.query.js';
import { CancelQuoteUseCase } from './application/use-cases/cancel-quote.use-case.js';
import { CompleteServiceUseCase } from './application/use-cases/complete-service.use-case.js';
import { ConfirmQuoteUseCase } from './application/use-cases/confirm-quote.use-case.js';
import { CreateQuoteFromCustomerUseCase } from './application/use-cases/create-quote-from-customer.use-case.js';
import { DeleteDraftQuoteUseCase } from './application/use-cases/delete-draft-quote.use-case.js';
import { MarkQuoteAsSentUseCase } from './application/use-cases/mark-quote-as-sent.use-case.js';
import { RemoveInstallationUseCase } from './application/use-cases/remove-installation.use-case.js';
import { RenewQuoteUseCase } from './application/use-cases/renew-quote.use-case.js';
import { ReopenQuoteUseCase } from './application/use-cases/reopen-quote.use-case.js';
import { ScheduleInstallationUseCase } from './application/use-cases/schedule-installation.use-case.js';
import { StartProductionUseCase } from './application/use-cases/start-production.use-case.js';
import { UpdateQuoteUseCase } from './application/use-cases/update-quote.use-case.js';
import { QuoteRepository } from './domain/repositories/quote.repository.js';
import { BusinessLogoLoader } from './infrastructure/documents/business-logo-loader.js';
import { PdfLibQuoteDocumentRenderer } from './infrastructure/documents/pdf-lib-quote-document-renderer.js';
import { PrismaCustomerEligibility } from './infrastructure/persistence/prisma-customer-eligibility.js';
import { PrismaQuoteHistoryQueryRepository } from './infrastructure/persistence/prisma-quote-history-query.repository.js';
import { PrismaQuoteHistoryWriter } from './infrastructure/persistence/prisma-quote-history-writer.js';
import { PrismaQuoteSequence } from './infrastructure/persistence/prisma-quote-sequence.js';
import { PrismaQuoteRepository } from './infrastructure/persistence/prisma-quote.repository.js';
import { PrismaSearchQuotesQuery } from './infrastructure/persistence/prisma-search-quotes.query.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { OrcamentosController } from './presentation/orcamentos.controller.js';

@Module({
  imports: [AuthModule, PrismaModule, DadosDoNegocioModule, ClientesModule],
  controllers: [OrcamentosController],
  providers: [
    { provide: QuoteRepository, useClass: PrismaQuoteRepository },
    { provide: CustomerEligibility, useClass: PrismaCustomerEligibility },
    { provide: Clock, useClass: SystemClock },
    {
      provide: QuoteHistoryQueryRepository,
      useClass: PrismaQuoteHistoryQueryRepository,
    },
    { provide: QuoteHistoryWriter, useClass: PrismaQuoteHistoryWriter },
    {
      provide: QuoteDocumentRenderer,
      useClass: PdfLibQuoteDocumentRenderer,
    },
    BusinessLogoLoader,
    {
      provide: QuoteSearchQueryRepository,
      useClass: PrismaSearchQuotesQuery,
    },
    PrismaQuoteSequence,
    CreateQuoteFromCustomerUseCase,
    UpdateQuoteUseCase,
    DeleteDraftQuoteUseCase,
    MarkQuoteAsSentUseCase,
    ConfirmQuoteUseCase,
    ReopenQuoteUseCase,
    RenewQuoteUseCase,
    CancelQuoteUseCase,
    StartProductionUseCase,
    CompleteServiceUseCase,
    ScheduleInstallationUseCase,
    RemoveInstallationUseCase,
    GetQuoteQuery,
    SearchQuotesQuery,
    ListCustomerQuotesQuery,
    ListQuoteHistoryQuery,
  ],
})
export class OrcamentosModule {}
