import { Injectable } from '@nestjs/common';
import { GetCustomerContactQuery } from '../../../clientes/application/get-customer-contact.query.js';
import { BusinessDataNotFoundError } from '../../../dados-do-negocio/application/business-data-not-found.error.js';
import { GetBusinessDataQuery } from '../../../dados-do-negocio/application/get-business-data.query.js';
import type { Quote } from '../../domain/entities/quote.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import {
  toCommercialPdfProjection,
  type CommercialPdfProjectionInput,
} from '../documents/build-commercial-pdf-projection.js';
import {
  CommercialPdfMode,
  resolveCommercialPdfMode,
} from '../documents/document-availability.js';
import { QuoteDocumentRenderer } from '../documents/quote-document-renderer.js';
import { BusinessDataNotConfiguredError } from '../errors/business-data-not-configured.error.js';
import { DocumentCustomerNotFoundError } from '../errors/document-customer-not-found.error.js';
import { DocumentDataIncompleteError } from '../errors/document-data-incomplete.error.js';
import { DocumentHistoryWriteError } from '../errors/document-history-write.error.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';
import { QuoteHistoryWriter } from '../ports/quote-history-writer.port.js';

export interface GenerateCommercialPdfInput {
  id: string;
}

/**
 * Generates the commercial PDF from current data (D177). In DRAFT it is a
 * preview without history (D178); in generation states it appends
 * COMMERCIAL_PDF_GENERATED only after rendering succeeds (D179/D180).
 */
@Injectable()
export class GenerateCommercialPdfUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly businessData: GetBusinessDataQuery,
    private readonly customers: GetCustomerContactQuery,
    private readonly renderer: QuoteDocumentRenderer,
    private readonly history: QuoteHistoryWriter,
    private readonly clock: Clock,
  ) {}

  async execute(input: GenerateCommercialPdfInput): Promise<Uint8Array> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    const mode = resolveCommercialPdfMode(quote.status);

    const businessIdentity = await this.loadBusinessIdentity();
    const customer = await this.customers.execute(quote.customerId);

    if (customer === null) {
      throw new DocumentCustomerNotFoundError();
    }

    // D164: generation requires the exact validity date; the DRAFT preview
    // omits it when absent.
    if (mode === CommercialPdfMode.GENERATION && quote.validUntil === null) {
      throw new DocumentDataIncompleteError();
    }

    const projection = toCommercialPdfProjection({
      quote,
      businessIdentity,
      customer,
    });

    // D165: a preview needs at least one representable service line.
    if (
      mode === CommercialPdfMode.PREVIEW &&
      projection.serviceLines.length === 0
    ) {
      throw new DocumentDataIncompleteError();
    }

    const bytes = await this.renderer.renderCommercialPdf(projection);

    if (mode === CommercialPdfMode.GENERATION) {
      await this.appendHistory(quote);
    }

    return bytes;
  }

  private async loadBusinessIdentity(): Promise<
    CommercialPdfProjectionInput['businessIdentity']
  > {
    try {
      const record = await this.businessData.execute();

      return {
        commercialNameOrConsultant: record.commercialNameOrConsultant,
        phone: record.phone,
        email: record.email,
        taxId: record.taxId,
      };
    } catch (error) {
      if (error instanceof BusinessDataNotFoundError) {
        throw new BusinessDataNotConfiguredError();
      }

      throw error;
    }
  }

  private async appendHistory(quote: Quote): Promise<void> {
    try {
      await this.history.append({
        quoteId: quote.id,
        event: { type: 'COMMERCIAL_PDF_GENERATED' },
        occurredAt: this.clock.now(),
      });
    } catch (error) {
      throw new DocumentHistoryWriteError(error);
    }
  }
}
