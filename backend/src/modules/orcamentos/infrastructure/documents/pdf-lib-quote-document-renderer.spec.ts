import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type {
  CommercialPdfProjection,
  ProductionOrderProjection,
} from '../../application/documents/document-projections.js';
import { PdfLibQuoteDocumentRenderer } from './pdf-lib-quote-document-renderer.js';

const COMMERCIAL: CommercialPdfProjection = {
  quoteNumber: 'ORÇ-2026-001',
  businessIdentity: {
    commercialNameOrConsultant: 'Cortinando',
    phone: '(11) 99999-9999',
  },
  customer: { name: 'Maria Silva', phone: '(11) 98888-7777' },
  serviceLines: [{ room: 'Sala' }],
  totalCents: 123_456,
  validUntil: new Date('2026-11-19T12:00:00.000Z'),
};

const PRODUCTION: ProductionOrderProjection = {
  quoteNumber: 'ORÇ-2026-002',
  curtains: [
    {
      sequence: 1,
      room: 'Sala',
      material: 'Linho',
      finalWidth: 2.9,
      height: 2.65,
    },
  ],
};

async function decodeContents(bytes: Uint8Array): Promise<string> {
  const document = await PDFDocument.load(bytes);

  return document.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .map((stream) =>
      Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'),
    )
    .join('\n');
}

describe('PdfLibQuoteDocumentRenderer', () => {
  let renderer: PdfLibQuoteDocumentRenderer;

  beforeEach(() => {
    renderer = new PdfLibQuoteDocumentRenderer();
  });

  it.each([
    [
      'commercial PDF',
      (): Promise<Uint8Array> => renderer.renderCommercialPdf(COMMERCIAL),
    ],
    [
      'production order',
      (): Promise<Uint8Array> => renderer.renderProductionOrder(PRODUCTION),
    ],
  ])('produces a valid A4 PDF for the %s', async (_label, render) => {
    const bytes = await render();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(bytes)).toBe(false);
    expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');

    const document = await PDFDocument.load(bytes);
    const pages = document.getPages();

    expect(pages).toHaveLength(1);
    expect(pages[0].getWidth()).toBeCloseTo(595.28, 2);
    expect(pages[0].getHeight()).toBeCloseTo(841.89, 2);
  });

  it('draws Brazilian Portuguese accented text with Helvetica', async () => {
    const bytes = await renderer.renderCommercialPdf(COMMERCIAL);
    const contents = await decodeContents(bytes);
    // pdf-lib writes drawn strings as WinAnsi-encoded hex operands.
    const drawnText = [...contents.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
      .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
      .join('\n');

    expect(drawnText).toContain('Documento em validação');
    expect(drawnText).toContain('ORÇ-2026-001');
  });
});
