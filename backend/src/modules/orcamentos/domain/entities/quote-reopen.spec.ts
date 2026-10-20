import { describe, expect, it } from 'vitest';
import { InvalidQuoteTransitionError } from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { QuoteNumber } from '../value-objects/quote-number.js';
import { Quote, QuoteStatus, type QuoteSnapshot } from './quote.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const confirmedAt = new Date('2026-10-25T12:00:00.000Z');
const past = new Date('2026-10-01T12:00:00.000Z');
const future = new Date('2026-12-01T12:00:00.000Z');
const scheduled = new Date('2026-11-10T12:00:00.000Z');
const now = new Date('2026-10-20T12:00:00.000Z');

function quoteWith(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: 'dd3f2c1b-0a99-4e4a-9f2e-1a2b3c4d5e6f',
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    status: QuoteStatus.CONFIRMED,
    installationAddress: null,
    curtains: [],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    firstSentAt: createdAt,
    validUntil: future,
    confirmedAt,
    productionStartedAt: null,
    scheduledInstallationAt: scheduled,
    completedAt: null,
    ...overrides,
  });
}

describe('Quote.reopen', () => {
  it('clears the confirmation and installation and returns both values', () => {
    const quote = quoteWith();

    const details = quote.reopen();

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.confirmedAt).toBeNull();
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(details).toEqual({
      previousConfirmedAt: confirmedAt,
      previousScheduledInstallationAt: scheduled,
    });
  });

  it('returns null when there was no installation scheduled', () => {
    const quote = quoteWith({ scheduledInstallationAt: null });

    expect(quote.reopen().previousScheduledInstallationAt).toBeNull();
  });

  it('preserves the number, first send and validity without renewing', () => {
    const quote = quoteWith({ validUntil: past });
    const quoteNumber = quote.quoteNumber;

    quote.reopen();

    expect(quote.quoteNumber).toBe(quoteNumber);
    expect(quote.firstSentAt).toBe(createdAt);
    expect(quote.validUntil).toBe(past);
  });

  it('keeps an expired quote expired after reopening', () => {
    const quote = quoteWith({ validUntil: past });

    quote.reopen();

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.isExpired(now)).toBe(true);
  });

  it('allows editing again after reopening', () => {
    const quote = quoteWith();

    quote.reopen();
    quote.applyPatch({ notes: '  Revisado após reabertura  ' });

    expect(quote.notes).toBe('Revisado após reabertura');
  });

  it('rejects reopening outside CONFIRMED without changing state', () => {
    for (const status of [
      QuoteStatus.DRAFT,
      QuoteStatus.SENT,
      QuoteStatus.IN_PRODUCTION,
      QuoteStatus.COMPLETED,
      QuoteStatus.CANCELLED,
    ]) {
      const quote = quoteWith({ status });

      expect(() => quote.reopen()).toThrow(InvalidQuoteTransitionError);
      expect(quote.status).toBe(status);
      expect(quote.confirmedAt).toBe(confirmedAt);
      expect(quote.scheduledInstallationAt).toBe(scheduled);
    }
  });
});
