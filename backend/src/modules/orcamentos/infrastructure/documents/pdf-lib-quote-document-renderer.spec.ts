import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import type {
  CommercialPdfProjection,
  ProductionOrderCurtainProjection,
  ProductionOrderProjection,
} from '../../application/documents/document-projections.js';
import {
  BusinessLogoLoader,
  LogoAssetMissingError,
} from './business-logo-loader.js';
import { PdfLibQuoteDocumentRenderer } from './pdf-lib-quote-document-renderer.js';

// A minimal transparent PNG used only to exercise image embedding while the
// real asset is pending (D150). It is never written to the assets directory.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

class StubLogoLoader extends BusinessLogoLoader {
  constructor(private readonly png: Uint8Array | null = null) {
    super();
  }

  override async load(): Promise<Uint8Array> {
    if (this.png === null) {
      throw new LogoAssetMissingError();
    }

    return this.png;
  }
}

function createRenderer(
  png: Uint8Array | null = null,
): PdfLibQuoteDocumentRenderer {
  return new PdfLibQuoteDocumentRenderer(new StubLogoLoader(png));
}

function projection(
  overrides: Partial<CommercialPdfProjection> = {},
): CommercialPdfProjection {
  return {
    quoteNumber: 'ORÇ-2026-015',
    businessIdentity: {
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@cortinando.com',
      taxId: '12345678000199',
    },
    customer: { name: 'Conceição João', phone: '(11) 98888-7777' },
    serviceLines: [
      { room: 'Sala', description: 'Janela principal' },
      { room: 'Quarto' },
    ],
    totalCents: 123456,
    validUntil: new Date('2026-11-19T12:00:00.000Z'),
    ...overrides,
  };
}

// pdf-lib writes drawn strings as WinAnsi-encoded hex operands.
async function extractDrawnText(bytes: Uint8Array): Promise<string> {
  const document = await PDFDocument.load(bytes);
  const decoder = new TextDecoder('windows-1252');
  const lines: string[] = [];

  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) {
      continue;
    }

    const contents = decoder.decode(decodePDFRawStream(object).decode());

    for (const match of contents.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      lines.push(decoder.decode(Buffer.from(match[1], 'hex')));
    }
  }

  return lines.join('\n');
}

function countImageObjects(document: PDFDocument): number {
  return document.context.enumerateIndirectObjects().filter(([, object]) => {
    if (!(object instanceof PDFRawStream)) {
      return false;
    }

    return object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image';
  }).length;
}

describe('PdfLibQuoteDocumentRenderer — commercial PDF', () => {
  it('renders a valid A4 PDF without the pending logo asset', async () => {
    const bytes = await createRenderer().renderCommercialPdf(projection());

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(bytes)).toBe(false);
    expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');

    const document = await PDFDocument.load(bytes);
    const pages = document.getPages();

    expect(pages).toHaveLength(1);
    expect(pages[0].getWidth()).toBeCloseTo(595.28, 2);
    expect(pages[0].getHeight()).toBeCloseTo(841.89, 2);
    expect(countImageObjects(document)).toBe(0);
  });

  it('renders the blocks in the order defined by D159', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(projection()),
    );
    const markers = [
      'Orçamento nº ORÇ-2026-015',
      'Cortinando',
      'DADOS DO CLIENTE',
      'Conceição João',
      'SERVIÇOS',
      'Sala — Janela principal — Cortina sob medida',
      'VALOR TOTAL DO SERVIÇO',
      'R$ 1.234,56',
      'Orçamento válido até: 19/11/2026',
    ];

    let previous = -1;

    for (const marker of markers) {
      const index = text.indexOf(marker);

      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it('composes one service line per curtain, omitting an absent description', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(
        projection({
          serviceLines: [
            { room: 'Sala', description: 'Janela principal' },
            { room: 'Quarto' },
          ],
        }),
      ),
    );

    expect(text).toContain('Sala — Janela principal — Cortina sob medida');
    expect(text).toContain('Quarto — Cortina sob medida');
  });

  it('renders optional identity fields and formats the business tax id', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(projection()),
    );

    expect(text).toContain('Telefone: (11) 99999-9999');
    expect(text).toContain('E-mail: contato@cortinando.com');
    expect(text).toContain('CPF/CNPJ: 12.345.678/0001-99');
  });

  it('omits empty optional identity fields', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(
        projection({
          businessIdentity: {
            commercialNameOrConsultant: 'Cortinando',
            phone: '(11) 99999-9999',
          },
        }),
      ),
    );

    expect(text).not.toContain('E-mail:');
    expect(text).not.toContain('CPF/CNPJ:');
  });

  it('omits the total and validity lines in a minimal DRAFT preview', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(
        projection({ totalCents: undefined, validUntil: undefined }),
      ),
    );

    expect(text).not.toContain('VALOR TOTAL DO SERVIÇO');
    expect(text).not.toContain('Orçamento válido até:');
  });

  it('renders accented Brazilian Portuguese text', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(
        projection({
          businessIdentity: {
            commercialNameOrConsultant: 'João Ação',
            phone: '(11) 99999-9999',
            email: 'joao@ação.com',
            taxId: '12345678901',
          },
          customer: { name: 'Conceição', phone: '(11) 98888-7777' },
          serviceLines: [{ room: 'Cozinha', description: 'Ação rápida' }],
        }),
      ),
    );

    expect(text).toContain('ORÇAMENTO');
    expect(text).toContain('João Ação');
    expect(text).toContain('Conceição');
    expect(text).toContain('Ação rápida');
    expect(text).toContain('Página 1');
  });

  it('paginates many curtains automatically', async () => {
    const serviceLines = Array.from({ length: 70 }, (_, index) => ({
      room: `Sala ${index + 1}`,
    }));
    const bytes = await createRenderer().renderCommercialPdf(
      projection({ serviceLines }),
    );
    const document = await PDFDocument.load(bytes);
    const text = await extractDrawnText(bytes);

    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain('Sala 1 — Cortina sob medida');
    expect(text).toContain('Sala 70 — Cortina sob medida');
    expect(text).toContain('VALOR TOTAL DO SERVIÇO');
    expect(text).toContain('Orçamento válido até: 19/11/2026');
  });

  it('wraps a long description across pages', async () => {
    const description = 'Descrição muito longa para teste de quebra '.repeat(
      250,
    );
    const bytes = await createRenderer().renderCommercialPdf(
      projection({ serviceLines: [{ room: 'Sala', description }] }),
    );
    const document = await PDFDocument.load(bytes);
    const text = await extractDrawnText(bytes);

    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain('Descrição muito longa');
    expect(text).toContain('quebra');
  });

  it('embeds the fixed logo image when the asset is available', async () => {
    const bytes =
      await createRenderer(ONE_PIXEL_PNG).renderCommercialPdf(projection());
    const document = await PDFDocument.load(bytes);

    // The transparent PNG also stores an alpha mask, so the logo produces one
    // image object plus its SMask.
    expect(countImageObjects(document)).toBeGreaterThanOrEqual(1);
  });

  it('never renders customer, commercial or internal forbidden data', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderCommercialPdf(projection()),
    );

    for (const forbidden of [
      '123.456.789-00',
      'Rua das Flores',
      'Linho',
      '2,9 m',
      '2,65 m',
      'Subtotal',
      'Desconto',
      'Ajuste comercial',
      'Frete',
      'Mão de obra',
      'Quantidade de tecido',
      'Fator',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('PdfLibQuoteDocumentRenderer — production order', () => {
  function curtain(
    overrides: Partial<ProductionOrderCurtainProjection> = {},
  ): ProductionOrderCurtainProjection {
    return {
      sequence: 1,
      room: 'Sala',
      description: 'Janela principal',
      material: 'Linho',
      finalWidth: 2.905,
      height: 2.65,
      ...overrides,
    };
  }

  function production(
    curtains: ProductionOrderCurtainProjection[] = [
      curtain(),
      curtain({
        sequence: 2,
        room: 'Quarto',
        description: undefined,
        material: 'Voil',
        finalWidth: 1.5,
        height: 2.2,
      }),
    ],
  ): ProductionOrderProjection {
    return { quoteNumber: 'ORÇ-2026-016', curtains };
  }

  it('renders a valid A4 PDF without logo or business identity', async () => {
    const bytes = await createRenderer().renderProductionOrder(production());
    const document = await PDFDocument.load(bytes);
    const pages = document.getPages();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
    expect(pages).toHaveLength(1);
    expect(pages[0].getWidth()).toBeCloseTo(595.28, 2);
    expect(pages[0].getHeight()).toBeCloseTo(841.89, 2);
    expect(countImageObjects(document)).toBe(0);
  });

  it('renders the title, quote number, table header and technical data', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderProductionOrder(production()),
    );

    expect(text).toContain('ORDEM DE PRODUÇÃO');
    expect(text).toContain('Orçamento nº ORÇ-2026-016');

    for (const header of [
      'Cortina',
      'Ambiente',
      'Descrição',
      'Material',
      'Largura final',
      'Altura',
    ]) {
      expect(text).toContain(header);
    }

    expect(text).toContain('Sala');
    expect(text).toContain('Janela principal');
    expect(text).toContain('Linho');
    expect(text).toContain('2,905 m');
    expect(text).toContain('2,65 m');
    expect(text).toContain('Quarto');
    expect(text).toContain('Voil');
    expect(text).toContain('1,5 m');
    expect(text).toContain('2,2 m');
  });

  it('keeps the projection order and omits an absent description', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderProductionOrder(production()),
    );

    expect(text.indexOf('Sala')).toBeLessThan(text.indexOf('Quarto'));
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('a definir');
  });

  it('renders accented technical text', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderProductionOrder(
        production([
          curtain({
            room: 'Cozinha',
            description: 'Ação rápida',
            material: 'Linho francês',
          }),
        ]),
      ),
    );

    expect(text).toContain('Ação rápida');
    expect(text).toContain('Linho francês');
    expect(text).toContain('Página 1');
  });

  it('paginates and repeats the table header on every page', async () => {
    const curtains = Array.from({ length: 50 }, (_, index) =>
      curtain({
        sequence: index + 1,
        room: `Ambiente ${index + 1}`,
        description: `Cortina ${index + 1}`,
      }),
    );
    const bytes = await createRenderer().renderProductionOrder(
      production(curtains),
    );
    const document = await PDFDocument.load(bytes);
    const text = await extractDrawnText(bytes);
    const pageCount = document.getPageCount();
    const headerCount = text.split('Material').length - 1;

    expect(pageCount).toBeGreaterThan(1);
    expect(text).toContain('Ambiente 1');
    expect(text).toContain('Ambiente 50');
    expect(headerCount).toBe(pageCount);
    expect(text).toContain(`Página ${pageCount}`);
  });

  it('wraps a long description inside its column and across pages', async () => {
    const description = 'Descrição longa para teste de quebra '.repeat(300);
    const bytes = await createRenderer().renderProductionOrder(
      production([curtain({ description })]),
    );
    const document = await PDFDocument.load(bytes);
    const text = await extractDrawnText(bytes);

    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(text).toContain('Descrição longa para teste');
    expect(text).toContain('quebra');
  });

  it('never renders customer, financial, identity or internal data', async () => {
    const text = await extractDrawnText(
      await createRenderer().renderProductionOrder(production()),
    );

    for (const forbidden of [
      'Cliente',
      'Telefone',
      'Maria Silva',
      '(11) 98888-7777',
      'Rua das Flores',
      'Cortinando',
      'R$',
      'Subtotal',
      'Desconto',
      'Ajuste',
      'Frete',
      'Mão de obra',
      'Quantidade de tecido',
      'Fator',
      'Borda',
      'Trilho',
      'Entretela',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
