import { Injectable } from '@nestjs/common';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type {
  CommercialPdfProjection,
  ProductionOrderProjection,
} from '../../application/documents/document-projections.js';
import {
  formatCurrency,
  formatDate,
  formatTaxId,
} from '../../application/documents/document-formatters.js';
import { QuoteDocumentRenderer } from '../../application/documents/quote-document-renderer.js';
import { DocumentRenderError } from '../../application/errors/document-render.error.js';
import {
  BusinessLogoLoader,
  LogoAssetMissingError,
} from './business-logo-loader.js';

// A4 portrait and fixed margins (D152).
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

const BODY_SIZE = 10;
const BODY_LINE_HEIGHT = 12;
const TITLE_SIZE = 16;
const SECTION_SIZE = 11;
const TOTAL_SIZE = 12;
const FOOTER_SIZE = 8;

const MAX_LOGO_WIDTH = 140;
const MAX_LOGO_HEIGHT = 56;
const AFTER_LOGO_GAP = 12;
const AFTER_BLOCK_GAP = 10;

interface TextOptions {
  bold?: boolean;
  size?: number;
  lineHeight?: number;
  indent?: number;
  color?: RGB;
}

// Vertical cursor with automatic page breaks (D152). Content never crosses the
// bottom margin; long values are wrapped before being drawn.
class DocumentWriter {
  private readonly pages: PDFPage[] = [];
  private page: PDFPage;
  private cursorY: number;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = this.addPage();
    this.cursorY = A4_HEIGHT - MARGIN;
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  get y(): number {
    return this.cursorY;
  }

  ensureSpace(height: number): void {
    if (this.cursorY - height < MARGIN) {
      this.page = this.addPage();
      this.cursorY = A4_HEIGHT - MARGIN;
    }
  }

  advance(height: number): void {
    this.ensureSpace(height);
    this.cursorY -= height;
  }

  drawLine(value: string, options: TextOptions = {}): void {
    const font = options.bold === true ? this.bold : this.regular;
    const size = options.size ?? BODY_SIZE;
    const lineHeight = options.lineHeight ?? BODY_LINE_HEIGHT;
    const indent = options.indent ?? 0;

    for (const line of wrapText(value, font, size, CONTENT_WIDTH - indent)) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.cursorY - size,
        size,
        font,
        color: options.color ?? rgb(0, 0, 0),
      });
      this.cursorY -= lineHeight;
    }
  }

  drawFooters(): void {
    this.pages.forEach((page, index) => {
      const label = `Página ${index + 1}`;
      const width = this.regular.widthOfTextAtSize(label, FOOTER_SIZE);

      page.drawText(label, {
        x: (A4_WIDTH - width) / 2,
        y: MARGIN / 2,
        size: FOOTER_SIZE,
        font: this.regular,
        color: rgb(0.4, 0.4, 0.4),
      });
    });
  }

  private addPage(): PDFPage {
    const page = this.document.addPage([A4_WIDTH, A4_HEIGHT]);
    this.pages.push(page);

    return page;
  }
}

@Injectable()
export class PdfLibQuoteDocumentRenderer extends QuoteDocumentRenderer {
  constructor(private readonly logoLoader: BusinessLogoLoader) {
    super();
  }

  async renderCommercialPdf(
    projection: CommercialPdfProjection,
  ): Promise<Uint8Array> {
    try {
      const document = await PDFDocument.create();
      const regular = await document.embedFont(StandardFonts.Helvetica);
      const bold = await document.embedFont(StandardFonts.HelveticaBold);
      const writer = new DocumentWriter(document, regular, bold);

      this.drawHeader(writer, projection);
      await this.drawLogo(document, writer);
      this.drawBusinessIdentity(writer, projection);
      this.drawCustomer(writer, projection);
      this.drawServices(writer, projection);
      this.drawTotal(writer, projection);
      this.drawValidity(writer, projection);
      writer.drawFooters();

      return await document.save();
    } catch (error) {
      throw new DocumentRenderError(error);
    }
  }

  async renderProductionOrder(
    projection: ProductionOrderProjection,
  ): Promise<Uint8Array> {
    return this.renderPlaceholder(projection.quoteNumber);
  }

  // D150: the real logo is embedded when present. While the operational asset
  // is pending, the document is rendered without it; no substitute image is
  // ever generated.
  private async drawLogo(
    document: PDFDocument,
    writer: DocumentWriter,
  ): Promise<void> {
    let logo: PDFImage;

    try {
      logo = await document.embedPng(await this.logoLoader.load());
    } catch (error) {
      if (error instanceof LogoAssetMissingError) {
        return;
      }

      throw error;
    }

    const scale = Math.min(
      MAX_LOGO_WIDTH / logo.width,
      MAX_LOGO_HEIGHT / logo.height,
      1,
    );
    const width = logo.width * scale;
    const height = logo.height * scale;

    writer.currentPage.drawImage(logo, {
      x: MARGIN,
      y: writer.y - height,
      width,
      height,
    });
    writer.advance(height + AFTER_LOGO_GAP);
  }

  private drawHeader(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    writer.drawLine('ORÇAMENTO', {
      bold: true,
      size: TITLE_SIZE,
      lineHeight: 20,
    });
    writer.drawLine(`Orçamento nº ${projection.quoteNumber}`, {
      bold: true,
      size: SECTION_SIZE,
      lineHeight: 14,
    });
    writer.advance(AFTER_BLOCK_GAP);
  }

  private drawBusinessIdentity(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    const identity = projection.businessIdentity;

    if (identity.commercialNameOrConsultant.trim() !== '') {
      writer.drawLine(identity.commercialNameOrConsultant, {
        bold: true,
        size: SECTION_SIZE,
        lineHeight: 14,
      });
    }

    if (identity.phone.trim() !== '') {
      writer.drawLine(`Telefone: ${identity.phone}`);
    }

    if (identity.email !== undefined && identity.email.trim() !== '') {
      writer.drawLine(`E-mail: ${identity.email}`);
    }

    if (identity.taxId !== undefined && identity.taxId.trim() !== '') {
      writer.drawLine(`CPF/CNPJ: ${formatTaxId(identity.taxId)}`);
    }

    writer.advance(AFTER_BLOCK_GAP);
  }

  private drawCustomer(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    writer.ensureSpace(14 + BODY_LINE_HEIGHT);
    writer.drawLine('DADOS DO CLIENTE', {
      bold: true,
      size: SECTION_SIZE,
      lineHeight: 14,
    });

    if (projection.customer.name.trim() !== '') {
      writer.drawLine(projection.customer.name);
    }

    if (projection.customer.phone.trim() !== '') {
      writer.drawLine(`Telefone: ${projection.customer.phone}`);
    }

    writer.advance(AFTER_BLOCK_GAP);
  }

  private drawServices(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    writer.ensureSpace(14 + BODY_LINE_HEIGHT);
    writer.drawLine('SERVIÇOS', {
      bold: true,
      size: SECTION_SIZE,
      lineHeight: 14,
    });

    // D161: one line per curtain, keeping the aggregate order. No price,
    // measurement, material or quantity belongs here.
    for (const serviceLine of projection.serviceLines) {
      const description = serviceLine.description?.trim();
      const value =
        description === undefined || description === ''
          ? `${serviceLine.room} — Cortina sob medida`
          : `${serviceLine.room} — ${description} — Cortina sob medida`;

      writer.drawLine(value, { indent: 8 });
    }

    // Avoid creating a trailing page when no block follows the list.
    if (
      projection.totalCents !== undefined ||
      projection.validUntil !== undefined
    ) {
      writer.advance(AFTER_BLOCK_GAP);
    }
  }

  private drawTotal(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    // D165/D166: a DRAFT preview omits the summary while the total is zero.
    if (projection.totalCents === undefined) {
      return;
    }

    // Keep the label and the amount together on the same page.
    writer.ensureSpace(14 + 16);
    writer.drawLine('VALOR TOTAL DO SERVIÇO', {
      bold: true,
      size: SECTION_SIZE,
      lineHeight: 14,
    });
    writer.drawLine(formatCurrency(projection.totalCents), {
      bold: true,
      size: TOTAL_SIZE,
      lineHeight: 16,
    });

    if (projection.validUntil !== undefined) {
      writer.advance(AFTER_BLOCK_GAP);
    }
  }

  private drawValidity(
    writer: DocumentWriter,
    projection: CommercialPdfProjection,
  ): void {
    // D164/D166: only generation states and previews with a defined date show
    // the validity line.
    if (projection.validUntil === undefined) {
      return;
    }

    writer.ensureSpace(BODY_LINE_HEIGHT);
    writer.drawLine(
      `Orçamento válido até: ${formatDate(projection.validUntil)}`,
    );
  }

  // Temporary production-order output (DOCUMENTOS-16 replaces it).
  private async renderPlaceholder(quoteNumber: string): Promise<Uint8Array> {
    try {
      const document = await PDFDocument.create();
      const font = await document.embedFont(StandardFonts.Helvetica);
      const page = document.addPage([A4_WIDTH, A4_HEIGHT]);

      page.drawText(`Documento em validação — ${quoteNumber}`, {
        x: MARGIN,
        y: A4_HEIGHT - MARGIN,
        size: 12,
        font,
      });

      return await document.save();
    } catch (error) {
      throw new DocumentRenderError(error);
    }
  }
}

// Greedy word wrapping with a fixed maximum width (D152). A word wider than
// the available width is split by characters so it cannot overflow the page.
function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = value
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line !== '') {
      lines.push(line);
      line = '';
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = '';

    for (const character of word) {
      const next = chunk + character;

      if (chunk !== '' && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }

    line = chunk;
  }

  if (line !== '') {
    lines.push(line);
  }

  return lines;
}
