import { QuoteStatus } from '../../domain/entities/quote.js';
import { DocumentNotAvailableError } from '../errors/document-not-available.error.js';

// Availability rules live outside the renderer (D174/D175). EXPIRED is not a
// persisted status: it is a SENT quote whose validity has elapsed, and it is
// treated exactly like SENT by both rules.
export enum CommercialPdfMode {
  PREVIEW = 'PREVIEW',
  GENERATION = 'GENERATION',
}

export function resolveCommercialPdfMode(
  status: QuoteStatus,
): CommercialPdfMode {
  switch (status) {
    case QuoteStatus.DRAFT:
      return CommercialPdfMode.PREVIEW;
    case QuoteStatus.SENT:
    case QuoteStatus.CONFIRMED:
    case QuoteStatus.IN_PRODUCTION:
    case QuoteStatus.COMPLETED:
      return CommercialPdfMode.GENERATION;
    case QuoteStatus.CANCELLED:
      throw new DocumentNotAvailableError();
  }
}

export function assertProductionOrderAvailable(status: QuoteStatus): void {
  switch (status) {
    case QuoteStatus.CONFIRMED:
    case QuoteStatus.IN_PRODUCTION:
    case QuoteStatus.COMPLETED:
      return;
    case QuoteStatus.DRAFT:
    case QuoteStatus.SENT:
    case QuoteStatus.CANCELLED:
      throw new DocumentNotAvailableError();
  }
}
