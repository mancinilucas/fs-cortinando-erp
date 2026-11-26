import { randomUUID } from 'node:crypto';
import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import { Quote, QuoteStatus } from '../../domain/entities/quote.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import {
  toCommercialPdfProjection,
  type CommercialPdfProjectionInput,
} from './build-commercial-pdf-projection.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const VALID_UNTIL = new Date('2026-11-19T12:00:00.000Z');

const BUSINESS_IDENTITY: CommercialPdfProjectionInput['businessIdentity'] = {
  commercialNameOrConsultant: 'Cortinando',
  phone: '(11) 99999-9999',
  email: 'contato@example.com',
  taxId: '12345678901',
};

const CUSTOMER = { name: 'Maria Silva', phone: '(11) 98888-7777' };

interface QuoteFixtureInput {
  status?: QuoteStatus;
  notes?: string | null;
  validUntil?: Date | null;
  curtains?: Curtain[];
  items?: Array<{ curtainId: string | null; unitPriceCents: number }>;
}

function makeQuote(input: QuoteFixtureInput = {}): Quote {
  const id = randomUUID();

  return Quote.rehydrate({
    id,
    quoteNumber: QuoteNumber.create(2026, 1),
    customerId: randomUUID(),
    status: input.status ?? QuoteStatus.DRAFT,
    installationAddress: null,
    curtains: input.curtains ?? [],
    financialItems: (input.items ?? []).map((item) =>
      FinancialItem.rehydrate({
        id: randomUUID(),
        quoteId: id,
        curtainId: item.curtainId,
        name: 'SENTINELA-COMPONENTE',
        quantity: 1,
        unit: 'un',
        unitPriceCents: item.unitPriceCents,
      }),
    ),
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: input.notes ?? null,
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: null,
    validUntil: input.validUntil ?? null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
  });
}

function makeCurtain(
  input: {
    room?: string | null;
    description?: string | null;
  } = {},
): Curtain {
  return Curtain.create({
    room: input.room === undefined ? 'Sala' : input.room,
    description: input.description ?? null,
    material: 'SENTINELA-MATERIAL',
    openingWidth: 2.6,
    height: 2.65,
    borderValue: 0.15,
    fabricFactor: 3.5,
    notes: 'SENTINELA-NOTA-CORTINA',
  });
}

function build(
  quote: Quote,
  overrides: Partial<CommercialPdfProjectionInput> = {},
) {
  return toCommercialPdfProjection({
    quote,
    businessIdentity: BUSINESS_IDENTITY,
    customer: CUSTOMER,
    ...overrides,
  });
}

describe('toCommercialPdfProjection', () => {
  it('builds the quote number, full business identity and customer contact', () => {
    const projection = build(makeQuote());

    expect(projection.quoteNumber).toBe('ORÇ-2026-001');
    expect(projection.businessIdentity).toEqual(BUSINESS_IDENTITY);
    expect(projection.customer).toEqual({
      name: 'Maria Silva',
      phone: '(11) 98888-7777',
    });
  });

  it('omits null and whitespace-only business identity optionals', () => {
    const projection = build(makeQuote(), {
      businessIdentity: {
        commercialNameOrConsultant: 'Cortinando',
        phone: '(11) 99999-9999',
        email: null,
        taxId: '   ',
      },
    });

    expect(projection.businessIdentity).toEqual({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
    });
  });

  it('builds one service line per curtain, preserving order and optional description', () => {
    const quote = makeQuote({
      curtains: [
        makeCurtain({ room: 'Sala', description: 'Janela principal' }),
        makeCurtain({ room: 'Quarto', description: null }),
        makeCurtain({ room: 'Escritório', description: '   ' }),
      ],
    });

    expect(build(quote).serviceLines).toEqual([
      { room: 'Sala', description: 'Janela principal' },
      { room: 'Quarto' },
      { room: 'Escritório' },
    ]);
  });

  it('omits curtains that still have no room in a DRAFT preview', () => {
    const quote = makeQuote({
      curtains: [
        makeCurtain({ room: null, description: 'Sem ambiente' }),
        makeCurtain({ room: 'Sala' }),
      ],
    });

    expect(build(quote).serviceLines).toEqual([{ room: 'Sala' }]);
  });

  it('includes the consolidated total outside DRAFT', () => {
    const curtain = makeCurtain();
    const quote = makeQuote({
      status: QuoteStatus.SENT,
      validUntil: VALID_UNTIL,
      curtains: [curtain],
      items: [{ curtainId: curtain.id, unitPriceCents: 123_456 }],
    });

    expect(build(quote).totalCents).toBe(123_456);
  });

  it('omits the total when it is zero in a DRAFT preview', () => {
    const projection = build(makeQuote({ curtains: [makeCurtain()] }));

    expect(projection).not.toHaveProperty('totalCents');
  });

  it('keeps a non-zero DRAFT total', () => {
    const curtain = makeCurtain();
    const quote = makeQuote({
      curtains: [curtain],
      items: [{ curtainId: curtain.id, unitPriceCents: 50_000 }],
    });

    expect(build(quote).totalCents).toBe(50_000);
  });

  it('omits a null validity and keeps the exact date when present', () => {
    expect(build(makeQuote())).not.toHaveProperty('validUntil');
    expect(
      build(makeQuote({ status: QuoteStatus.SENT, validUntil: VALID_UNTIL })),
    ).toHaveProperty('validUntil', VALID_UNTIL);
  });

  it('exposes only the authorized fields and no forbidden data', () => {
    const curtain = makeCurtain();
    const quote = makeQuote({
      status: QuoteStatus.SENT,
      validUntil: VALID_UNTIL,
      notes: 'SENTINELA-NOTA-INTERNA',
      curtains: [curtain],
      items: [{ curtainId: curtain.id, unitPriceCents: 123_456 }],
    });

    const projection = build(quote);

    expect(Object.keys(projection).sort()).toEqual([
      'businessIdentity',
      'customer',
      'quoteNumber',
      'serviceLines',
      'totalCents',
      'validUntil',
    ]);
    expect(Object.keys(projection.businessIdentity).sort()).toEqual([
      'commercialNameOrConsultant',
      'email',
      'phone',
      'taxId',
    ]);
    expect(Object.keys(projection.customer).sort()).toEqual(['name', 'phone']);
    expect(Object.keys(projection.serviceLines[0]).sort()).toEqual(['room']);

    const serialized = JSON.stringify(projection);

    expect(serialized).not.toContain('SENTINELA-MATERIAL');
    expect(serialized).not.toContain('SENTINELA-NOTA');
    expect(serialized).not.toContain('SENTINELA-COMPONENTE');
    expect(serialized).not.toContain(quote.customerId);
  });
});
