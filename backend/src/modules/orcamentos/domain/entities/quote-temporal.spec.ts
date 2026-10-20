import { describe, expect, it } from 'vitest';
import { QuoteValidationError } from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { InstallationAddress } from '../value-objects/installation-address.js';
import { QuoteNumber } from '../value-objects/quote-number.js';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import { Quote, QuoteStatus, type QuoteSnapshot } from './quote.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const now = new Date('2026-10-20T12:00:00.000Z');
const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const future = new Date('2026-12-01T12:00:00.000Z');
const past = new Date('2026-10-01T12:00:00.000Z');

function draftQuote(): Quote {
  return Quote.create({
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    createdAt,
    installationAddress: InstallationAddress.create({
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
    }),
    curtains: [
      Curtain.create({
        room: 'Sala',
        material: 'Linho',
        openingWidth: 2,
        height: 2.7,
        components: [
          FinancialItem.create({
            name: 'Tecido',
            quantity: 8.05,
            unitPriceCents: 3_000,
          }),
        ],
      }),
    ],
  });
}

function quoteWith(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: 'dd3f2c1b-0a99-4e4a-9f2e-1a2b3c4d5e6f',
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    status: QuoteStatus.SENT,
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
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

describe('Quote temporal rules', () => {
  it('applies the default validity of 30 days on the first send', () => {
    const quote = draftQuote();

    quote.markAsSent(now);

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt).toBe(now);
    expect(quote.validUntil).toEqual(thirtyDaysLater);
  });

  it('treats a null validity as absent', () => {
    const quote = draftQuote();

    quote.markAsSent(now, null);

    expect(quote.validUntil).toEqual(thirtyDaysLater);
  });

  it('applies an explicitly informed future validity', () => {
    const quote = draftQuote();

    quote.markAsSent(now, future);

    expect(quote.firstSentAt).toBe(now);
    expect(quote.validUntil).toBe(future);
  });

  it('rejects a past validity and keeps the quote as DRAFT', () => {
    const quote = draftQuote();

    try {
      quote.markAsSent(now, past);

      throw new Error('markAsSent should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError);
      expect((error as QuoteValidationError).violations).toContainEqual(
        expect.objectContaining({ code: 'VALID_UNTIL_NOT_FUTURE' }),
      );
    }

    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.firstSentAt).toBeNull();
    expect(quote.validUntil).toBeNull();
  });

  it('rejects a validity exactly at the sending instant', () => {
    const quote = draftQuote();

    expect(() => quote.markAsSent(now, new Date(now))).toThrow(
      QuoteValidationError,
    );
    expect(quote.status).toBe(QuoteStatus.DRAFT);
  });

  it('derives expiration only for SENT after the validity', () => {
    expect(quoteWith({ validUntil: past }).isExpired(now)).toBe(true);
    expect(quoteWith({ validUntil: future }).isExpired(now)).toBe(false);
    expect(quoteWith({ validUntil: new Date(now) }).isExpired(now)).toBe(false);
  });

  it('does not consider a quote without validity as expired', () => {
    expect(quoteWith({ validUntil: null }).isExpired(now)).toBe(false);
  });

  it('does not derive expiration for other statuses', () => {
    for (const status of [
      QuoteStatus.DRAFT,
      QuoteStatus.CONFIRMED,
      QuoteStatus.IN_PRODUCTION,
      QuoteStatus.COMPLETED,
      QuoteStatus.CANCELLED,
    ]) {
      expect(quoteWith({ status, validUntil: past }).isExpired(now)).toBe(
        false,
      );
    }
  });

  it('derives a late installation for confirmed and in-production quotes', () => {
    for (const status of [QuoteStatus.CONFIRMED, QuoteStatus.IN_PRODUCTION]) {
      expect(
        quoteWith({ status, scheduledInstallationAt: past }).isLateInstallation(
          now,
        ),
      ).toBe(true);
    }
  });

  it('does not derive a late installation in the future or exactly now', () => {
    expect(
      quoteWith({
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: future,
      }).isLateInstallation(now),
    ).toBe(false);
    expect(
      quoteWith({
        status: QuoteStatus.CONFIRMED,
        scheduledInstallationAt: new Date(now),
      }).isLateInstallation(now),
    ).toBe(false);
  });

  it('does not derive a late installation without a schedule or in other statuses', () => {
    expect(
      quoteWith({ status: QuoteStatus.CONFIRMED }).isLateInstallation(now),
    ).toBe(false);

    for (const status of [
      QuoteStatus.DRAFT,
      QuoteStatus.SENT,
      QuoteStatus.COMPLETED,
      QuoteStatus.CANCELLED,
    ]) {
      expect(
        quoteWith({ status, scheduledInstallationAt: past }).isLateInstallation(
          now,
        ),
      ).toBe(false);
    }
  });

  it('renews a valid quote preserving firstSentAt and status', () => {
    const quote = quoteWith({ validUntil: future });

    quote.renew(new Date('2027-01-15T12:00:00.000Z'), now);

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt).toBe(createdAt);
    expect(quote.validUntil).toEqual(new Date('2027-01-15T12:00:00.000Z'));
  });

  it('renews an expired quote', () => {
    const quote = quoteWith({ validUntil: past });
    const renewed = new Date('2026-11-30T12:00:00.000Z');

    quote.renew(renewed, now);

    expect(quote.isExpired(now)).toBe(false);
    expect(quote.validUntil).toBe(renewed);
  });

  it('rejects a non-future renewal without changing the validity', () => {
    const quote = quoteWith({ validUntil: future });

    expect(() => quote.renew(past, now)).toThrow(QuoteValidationError);
    expect(() => quote.renew(new Date(now), now)).toThrow(QuoteValidationError);
    expect(quote.validUntil).toBe(future);
  });

  it('keeps the temporal data when a SENT quote is edited', () => {
    const quote = quoteWith({ validUntil: future });

    quote.applyPatch({ notes: 'Ajuste comercial' });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt).toBe(createdAt);
    expect(quote.validUntil).toBe(future);
  });

  it('rejects invalid reference instants', () => {
    const quote = quoteWith();
    const invalid = new Date(Number.NaN);

    expect(() => quote.isExpired(invalid)).toThrow(RangeError);
    expect(() => quote.isLateInstallation(invalid)).toThrow(RangeError);
    expect(() => draftQuote().markAsSent(invalid)).toThrow(RangeError);
    expect(() => quote.renew(future, invalid)).toThrow(RangeError);
    expect(() => quote.renew(invalid, now)).toThrow(RangeError);
  });
});
