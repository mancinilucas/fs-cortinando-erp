import { describe, expect, it } from 'vitest';
import { InvalidQuoteTransitionError } from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { InstallationAddress } from '../value-objects/installation-address.js';
import { QuoteNumber } from '../value-objects/quote-number.js';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import type { QuoteSnapshot } from './quote.js';
import { Quote, QuoteStatus } from './quote.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const now = new Date('2026-10-20T12:00:00.000Z');
const future = new Date('2026-11-19T12:00:00.000Z');

function quoteWithValidData(): Quote {
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

function quoteInStatus(
  status: QuoteStatus,
  overrides: Partial<QuoteSnapshot> = {},
): Quote {
  return Quote.rehydrate({
    id: 'dd3f2c1b-0a99-4e4a-9f2e-1a2b3c4d5e6f',
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    status,
    installationAddress: null,
    curtains: [],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    firstSentAt: null,
    validUntil: null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

const allStatuses = [
  QuoteStatus.DRAFT,
  QuoteStatus.SENT,
  QuoteStatus.CONFIRMED,
  QuoteStatus.IN_PRODUCTION,
  QuoteStatus.COMPLETED,
  QuoteStatus.CANCELLED,
];

interface TransitionCase {
  name: string;
  allowedFrom: QuoteStatus[];
  expectedStatus: (from: QuoteStatus) => QuoteStatus;
  run: (quote: Quote) => void;
}

const transitions: TransitionCase[] = [
  {
    name: 'markAsSent',
    allowedFrom: [QuoteStatus.DRAFT],
    expectedStatus: () => QuoteStatus.SENT,
    run: (quote) => quote.markAsSent(),
  },
  {
    name: 'confirm',
    allowedFrom: [QuoteStatus.SENT],
    expectedStatus: () => QuoteStatus.CONFIRMED,
    run: (quote) => quote.confirm(now),
  },
  {
    name: 'reopen',
    allowedFrom: [QuoteStatus.CONFIRMED],
    expectedStatus: () => QuoteStatus.SENT,
    run: (quote) => quote.reopen(),
  },
  {
    name: 'renew',
    allowedFrom: [QuoteStatus.SENT],
    expectedStatus: () => QuoteStatus.SENT,
    run: (quote) => quote.renew(future),
  },
  {
    name: 'cancel',
    allowedFrom: [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.CONFIRMED],
    expectedStatus: () => QuoteStatus.CANCELLED,
    run: (quote) => quote.cancel('Motivo'),
  },
  {
    name: 'startProduction',
    allowedFrom: [QuoteStatus.CONFIRMED],
    expectedStatus: () => QuoteStatus.IN_PRODUCTION,
    run: (quote) => quote.startProduction(now),
  },
  {
    name: 'setScheduledInstallation',
    allowedFrom: [QuoteStatus.CONFIRMED, QuoteStatus.IN_PRODUCTION],
    expectedStatus: (from) => from,
    run: (quote) => quote.setScheduledInstallation(future),
  },
  {
    name: 'removeScheduledInstallation',
    allowedFrom: [QuoteStatus.CONFIRMED, QuoteStatus.IN_PRODUCTION],
    expectedStatus: (from) => from,
    run: (quote) => quote.removeScheduledInstallation(),
  },
  {
    name: 'complete',
    allowedFrom: [QuoteStatus.IN_PRODUCTION],
    expectedStatus: () => QuoteStatus.COMPLETED,
    run: (quote) => quote.complete(now),
  },
];

describe('Quote state machine', () => {
  describe.each(transitions)('$name', (transition) => {
    it.each(allStatuses)('from %s', (from) => {
      const quote =
        transition.name === 'markAsSent' && from === QuoteStatus.DRAFT
          ? quoteWithValidData()
          : quoteInStatus(from);
      const allowed = transition.allowedFrom.includes(from);

      if (allowed) {
        expect(() => transition.run(quote)).not.toThrow();
        expect(quote.status).toBe(transition.expectedStatus(from));
        return;
      }

      expect(() => transition.run(quote)).toThrow(InvalidQuoteTransitionError);
      expect(quote.status).toBe(from);
    });
  });

  it('records confirmedAt on confirmation', () => {
    const quote = quoteInStatus(QuoteStatus.SENT);

    quote.confirm(now);

    expect(quote.confirmedAt).toBe(now);
  });

  it('records productionStartedAt when production starts', () => {
    const quote = quoteInStatus(QuoteStatus.CONFIRMED);

    quote.startProduction(now);

    expect(quote.productionStartedAt).toBe(now);
  });

  it('records completedAt on completion', () => {
    const quote = quoteInStatus(QuoteStatus.IN_PRODUCTION);

    quote.complete(now);

    expect(quote.completedAt).toBe(now);
  });

  it('updates only validUntil on renewal', () => {
    const previousValidUntil = new Date('2026-10-25T12:00:00.000Z');
    const quote = quoteInStatus(QuoteStatus.SENT, {
      firstSentAt: createdAt,
      validUntil: previousValidUntil,
    });

    quote.renew(future);

    expect(quote.validUntil).toBe(future);
    expect(quote.firstSentAt).toBe(createdAt);
    expect(quote.status).toBe(QuoteStatus.SENT);
  });

  it('normalizes the cancellation reason and returns it for history', () => {
    const quote = quoteInStatus(QuoteStatus.DRAFT);

    expect(quote.cancel('  Cliente desistiu  ')).toBe('Cliente desistiu');
    expect(quote.status).toBe(QuoteStatus.CANCELLED);
  });

  it('treats a blank cancellation reason as absent', () => {
    expect(quoteInStatus(QuoteStatus.DRAFT).cancel('   ')).toBeNull();
    expect(quoteInStatus(QuoteStatus.DRAFT).cancel()).toBeNull();
  });

  it('rejects a cancellation reason longer than 500 characters', () => {
    const quote = quoteInStatus(QuoteStatus.SENT);

    expect(() => quote.cancel('a'.repeat(501))).toThrow(RangeError);
    expect(quote.status).toBe(QuoteStatus.SENT);
  });

  it('rejects invalid dates and does not change status', () => {
    const quote = quoteInStatus(QuoteStatus.SENT);

    expect(() => quote.confirm(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => quote.renew(new Date(Number.NaN))).toThrow(RangeError);
    expect(quote.status).toBe(QuoteStatus.SENT);
  });

  it('schedules, detects an unchanged value and changes the installation', () => {
    const quote = quoteInStatus(QuoteStatus.CONFIRMED);
    const first = new Date('2026-12-01T12:00:00.000Z');
    const second = new Date('2026-12-05T12:00:00.000Z');

    expect(quote.setScheduledInstallation(first)).toBe('SCHEDULED');
    expect(quote.scheduledInstallationAt).toBe(first);
    expect(quote.setScheduledInstallation(new Date(first))).toBe('UNCHANGED');
    expect(quote.scheduledInstallationAt).toBe(first);
    expect(quote.setScheduledInstallation(second)).toBe('CHANGED');
    expect(quote.scheduledInstallationAt).toBe(second);
    expect(quote.status).toBe(QuoteStatus.CONFIRMED);
  });

  it('removes the installation and returns the previous value', () => {
    const scheduled = new Date('2026-12-01T12:00:00.000Z');
    const quote = quoteInStatus(QuoteStatus.IN_PRODUCTION, {
      scheduledInstallationAt: scheduled,
    });

    expect(quote.removeScheduledInstallation()).toBe(scheduled);
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.removeScheduledInstallation()).toBeNull();
  });
});
