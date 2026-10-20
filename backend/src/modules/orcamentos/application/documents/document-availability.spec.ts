import { randomUUID } from 'node:crypto';
import {
  Quote,
  QuoteStatus,
  type QuoteSnapshot,
} from '../../domain/entities/quote.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import { DocumentNotAvailableError } from '../errors/document-not-available.error.js';
import {
  CommercialPdfMode,
  assertProductionOrderAvailable,
  resolveCommercialPdfMode,
} from './document-availability.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');

function makeQuote(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: randomUUID(),
    quoteNumber: QuoteNumber.create(2026, 1),
    customerId: randomUUID(),
    status: QuoteStatus.SENT,
    installationAddress: null,
    curtains: [],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: NOW,
    validUntil: new Date('2026-11-19T12:00:00.000Z'),
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

describe('commercial PDF availability', () => {
  it.each([
    [QuoteStatus.DRAFT, CommercialPdfMode.PREVIEW],
    [QuoteStatus.SENT, CommercialPdfMode.GENERATION],
    [QuoteStatus.CONFIRMED, CommercialPdfMode.GENERATION],
    [QuoteStatus.IN_PRODUCTION, CommercialPdfMode.GENERATION],
    [QuoteStatus.COMPLETED, CommercialPdfMode.GENERATION],
  ])('maps %s to %s', (status, mode) => {
    expect(resolveCommercialPdfMode(status)).toBe(mode);
  });

  it('treats an EXPIRED quote (SENT with elapsed validity) as generation', () => {
    const quote = makeQuote({
      status: QuoteStatus.SENT,
      validUntil: new Date('2026-10-01T12:00:00.000Z'),
    });

    expect(quote.isExpired(NOW)).toBe(true);
    expect(resolveCommercialPdfMode(quote.status)).toBe(
      CommercialPdfMode.GENERATION,
    );
  });

  it('rejects CANCELLED', () => {
    expect(() => resolveCommercialPdfMode(QuoteStatus.CANCELLED)).toThrow(
      DocumentNotAvailableError,
    );
  });
});

describe('production order availability', () => {
  it.each([
    QuoteStatus.CONFIRMED,
    QuoteStatus.IN_PRODUCTION,
    QuoteStatus.COMPLETED,
  ])('allows %s', (status) => {
    expect(() => assertProductionOrderAvailable(status)).not.toThrow();
  });

  it.each([QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.CANCELLED])(
    'rejects %s',
    (status) => {
      expect(() => assertProductionOrderAvailable(status)).toThrow(
        DocumentNotAvailableError,
      );
    },
  );

  it('rejects an EXPIRED quote (SENT with elapsed validity)', () => {
    const quote = makeQuote({
      status: QuoteStatus.SENT,
      validUntil: new Date('2026-10-01T12:00:00.000Z'),
    });

    expect(quote.isExpired(NOW)).toBe(true);
    expect(() => assertProductionOrderAvailable(quote.status)).toThrow(
      DocumentNotAvailableError,
    );
  });
});
