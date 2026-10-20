import { Injectable } from '@nestjs/common';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { toProductionOrderProjection } from '../documents/build-production-order-projection.js';
import { assertProductionOrderAvailable } from '../documents/document-availability.js';
import { QuoteDocumentRenderer } from '../documents/quote-document-renderer.js';
import { DocumentHistoryWriteError } from '../errors/document-history-write.error.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';
import { QuoteHistoryWriter } from '../ports/quote-history-writer.port.js';

export interface GenerateProductionOrderInput {
  id: string;
}

/**
 * Generates the production order from current data (D177). Every successful
 * generation records PRODUCTION_ORDER_GENERATED (D179); the use case neither
 * reads Customer nor BusinessData and never touches financial data (D170/D171).
 */
@Injectable()
export class GenerateProductionOrderUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly renderer: QuoteDocumentRenderer,
    private readonly history: QuoteHistoryWriter,
    private readonly clock: Clock,
  ) {}

  async execute(input: GenerateProductionOrderInput): Promise<Uint8Array> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    assertProductionOrderAvailable(quote.status);

    // Missing technical data fails here, before rendering and history (D173).
    const projection = toProductionOrderProjection(quote);

    const bytes = await this.renderer.renderProductionOrder(projection);

    try {
      await this.history.append({
        quoteId: quote.id,
        event: { type: 'PRODUCTION_ORDER_GENERATED' },
        occurredAt: this.clock.now(),
      });
    } catch (error) {
      throw new DocumentHistoryWriteError(error);
    }

    return bytes;
  }
}
