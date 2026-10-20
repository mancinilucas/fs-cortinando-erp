import { randomUUID } from 'node:crypto';
import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import {
  Quote,
  QuoteStatus,
  type QuoteSnapshot,
} from '../../domain/entities/quote.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { InstallationAddress } from '../../domain/value-objects/installation-address.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import { formatCurrency } from '../../application/documents/document-formatters.js';
import { toCommercialPdfProjection } from '../../application/documents/build-commercial-pdf-projection.js';
import { toProductionOrderProjection } from '../../application/documents/build-production-order-projection.js';
import { extractPdfText } from '../../../../../test/helpers/pdf-text.js';
import {
  BusinessLogoLoader,
  LogoAssetMissingError,
} from './business-logo-loader.js';
import { PdfLibQuoteDocumentRenderer } from './pdf-lib-quote-document-renderer.js';

// D200/D204: these tests render the real file and parse its text. The
// fixtures carry unique sentinel values for every forbidden field, so a
// renderer that draws any of them fails the assertion.

const NOW = new Date('2026-10-20T12:00:00.000Z');
const VALID_UNTIL = new Date('2026-11-19T12:00:00.000Z');

const BUSINESS_IDENTITY = {
  commercialNameOrConsultant: 'Cortinando',
  phone: '(11) 99999-9999',
  email: 'contato@cortinando.com',
  taxId: '12345678901',
};

// Extra properties are intentional: the projection input must ignore anything
// outside the authorized customer contact fields.
const CUSTOMER = {
  name: 'Maria Silva',
  phone: '(11) 98888-7777',
  taxId: 'SENTINELA-CPF-99988877766',
  address: 'Rua Sentinela Cliente 789',
};

const CUSTOMER_TAX_ID = '99988877766';

const COMPONENT_UNIT_PRICE_CENTS = 9_876_543;
const ADD_ON_UNIT_PRICE_CENTS = 8_765_432;
const ADJUSTMENT_CENTS = -1_234_321;

const INSTALLATION_ADDRESS = InstallationAddress.create({
  street: 'Rua Sentinela Instalacao 456',
  number: '123',
  neighborhood: 'Bairro Sentinela',
  city: 'Cidade Sentinela',
  state: 'SP',
});

function sentinelCurtain(material = 'SENTINELA-MATERIAL'): Curtain {
  return Curtain.create({
    room: 'Sala',
    description: 'Janela principal',
    material,
    openingWidth: 3.33,
    borderValue: 0.33,
    height: 4.44,
    fabricFactor: 5.5,
    notes: 'SENTINELA-NOTA-CORTINA',
    components: [
      FinancialItem.create({
        name: 'SENTINELA-COMPONENTE',
        quantity: 2.5,
        unit: 'm',
        unitPriceCents: COMPONENT_UNIT_PRICE_CENTS,
      }),
    ],
  });
}

function sentinelQuote(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: randomUUID(),
    quoteNumber: QuoteNumber.create(2026, 1),
    customerId: randomUUID(),
    status: QuoteStatus.SENT,
    installationAddress: INSTALLATION_ADDRESS,
    curtains: [sentinelCurtain()],
    generalAddOns: [
      FinancialItem.create({
        name: 'SENTINELA-ADICIONAL',
        quantity: 1,
        unit: null,
        unitPriceCents: ADD_ON_UNIT_PRICE_CENTS,
      }),
    ],
    discount: Discount.percentage(37),
    commercialAdjustmentCents: ADJUSTMENT_CENTS,
    notes: 'SENTINELA-NOTA-ORCAMENTO',
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: NOW,
    validUntil: VALID_UNTIL,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

class StubLogoLoader extends BusinessLogoLoader {
  override async load(): Promise<Uint8Array> {
    throw new LogoAssetMissingError();
  }
}

function renderer(): PdfLibQuoteDocumentRenderer {
  return new PdfLibQuoteDocumentRenderer(new StubLogoLoader());
}

function assertPdfFile(bytes: Uint8Array, totalPages: number): void {
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
  expect(totalPages).toBe(1);
}

describe('generated PDF content — commercial quote', () => {
  async function renderCommercial() {
    const quote = sentinelQuote();
    const projection = toCommercialPdfProjection({
      quote,
      businessIdentity: BUSINESS_IDENTITY,
      customer: CUSTOMER,
    });
    const bytes = await renderer().renderCommercialPdf(projection);

    return { quote, ...(await extractPdfText(bytes)), bytes };
  }

  it('contains the quote number, identity, customer, services, total and validity', async () => {
    const { quote, text, bytes, totalPages } = await renderCommercial();

    assertPdfFile(bytes, totalPages);

    for (const expected of [
      'ORÇAMENTO',
      'Orçamento nº ORÇ-2026-001',
      BUSINESS_IDENTITY.commercialNameOrConsultant,
      `Telefone: ${BUSINESS_IDENTITY.phone}`,
      `E-mail: ${BUSINESS_IDENTITY.email}`,
      'CPF/CNPJ: 123.456.789-01',
      'DADOS DO CLIENTE',
      CUSTOMER.name,
      `Telefone: ${CUSTOMER.phone}`,
      'SERVIÇOS',
      'Sala — Janela principal — Cortina sob medida',
      'VALOR TOTAL DO SERVIÇO',
      formatCurrency(quote.totalCents),
      'Orçamento válido até: 19/11/2026',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('never contains the forbidden customer fiscal data or addresses', async () => {
    const { text } = await renderCommercial();

    for (const forbidden of [
      CUSTOMER.taxId,
      CUSTOMER_TAX_ID,
      '999.888.777-66',
      CUSTOMER.address,
      'Rua Sentinela',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('never contains technical, financial or internal quote data', async () => {
    const { text } = await renderCommercial();

    for (const forbidden of [
      'SENTINELA',
      'Linho',
      '3,33 m',
      '0,33 m',
      '3,99 m',
      '4,44 m',
      '21,945 m',
      '5,5',
      formatCurrency(COMPONENT_UNIT_PRICE_CENTS),
      formatCurrency(ADD_ON_UNIT_PRICE_CENTS),
      formatCurrency(Math.abs(ADJUSTMENT_CENTS)),
      '37%',
      'Subtotal',
      'Desconto',
      'Ajuste',
      'Frete',
      'Mão de obra',
      'Quantidade de tecido',
      'Fator',
      'Borda',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('generated PDF content — production order', () => {
  async function renderProduction() {
    const quote = sentinelQuote({
      status: QuoteStatus.CONFIRMED,
      confirmedAt: NOW,
      // Material is authorized technical data for the production order, so it
      // is a real value here; the remaining sentinel fields stay in the quote.
      curtains: [sentinelCurtain('Linho')],
    });
    const bytes = await renderer().renderProductionOrder(
      toProductionOrderProjection(quote),
    );

    return { ...(await extractPdfText(bytes)), bytes };
  }

  it('contains only the authorized technical fields', async () => {
    const { text, bytes, totalPages } = await renderProduction();

    assertPdfFile(bytes, totalPages);

    for (const expected of [
      'ORDEM DE PRODUÇÃO',
      'Orçamento nº ORÇ-2026-001',
      'Cortina',
      'Ambiente',
      'Descrição',
      'Material',
      'Largura final',
      'Altura',
      'Sala',
      'Janela principal',
      'Linho',
      '3,99 m',
      '4,44 m',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('never contains customer, business, address or financial data', async () => {
    const { text } = await renderProduction();

    for (const forbidden of [
      'SENTINELA',
      CUSTOMER.name,
      CUSTOMER.phone,
      CUSTOMER_TAX_ID,
      '999.888.777-66',
      'Rua Sentinela',
      BUSINESS_IDENTITY.commercialNameOrConsultant,
      formatCurrency(COMPONENT_UNIT_PRICE_CENTS),
      formatCurrency(ADD_ON_UNIT_PRICE_CENTS),
      formatCurrency(Math.abs(ADJUSTMENT_CENTS)),
      'R$',
      '%',
      '37%',
      '3,33 m',
      '0,33 m',
      '21,945 m',
      '5,5',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('never renders forbidden technical or labor labels', async () => {
    const { text } = await renderProduction();

    for (const forbidden of [
      'Trilho',
      'Entretela',
      'Frete',
      'Mão de obra',
      'Subtotal',
      'Desconto',
      'Ajuste',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
