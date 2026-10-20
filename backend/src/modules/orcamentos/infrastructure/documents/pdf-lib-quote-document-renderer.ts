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
  ProductionOrderCurtainProjection,
  ProductionOrderProjection,
} from '../../application/documents/document-projections.js';
import {
  formatCurrency,
  formatDate,
  formatMeasure,
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

// Production order table (D169/D170). Column widths add up to CONTENT_WIDTH.
const TABLE_COLUMNS = [
  { label: 'Cortina', width: 45 },
  { label: 'Ambiente', width: 80 },
  { label: 'Descrição', width: 135 },
  { label: 'Material', width: 100 },
  { label: 'Largura final', width: 75 },
  { label: 'Altura', width: 64.28 },
] as const;
const TABLE_FONT_SIZE = 9;
const TABLE_LINE_HEIGHT = 11;
const TABLE_PADDING = 4;
const TABLE_HEADER_HEIGHT = TABLE_PADDING * 2 + TABLE_LINE_HEIGHT;

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

  get regularFont(): PDFFont {
    return this.regular;
  }

  hasSpace(height: number): boolean {
    return this.cursorY - height >= MARGIN;
  }

  pageBreak(): void {
    this.page = this.addPage();
    this.cursorY = A4_HEIGHT - MARGIN;
  }

  ensureSpace(height: number): void {
    if (!this.hasSpace(height)) {
      this.pageBreak();
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

  drawAt(
    value: string,
    x: number,
    baseline: number,
    options: { bold?: boolean; size?: number; color?: RGB } = {},
  ): void {
    this.page.drawText(value, {
      x,
      y: baseline,
      size: options.size ?? BODY_SIZE,
      font: options.bold === true ? this.bold : this.regular,
      color: options.color ?? rgb(0, 0, 0),
    });
  }

  drawRule(y: number): void {
    this.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
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
    try {
      const document = await PDFDocument.create();
      const regular = await document.embedFont(StandardFonts.Helvetica);
      const bold = await document.embedFont(StandardFonts.HelveticaBold);
      const writer = new DocumentWriter(document, regular, bold);

      writer.drawLine('ORDEM DE PRODUÇÃO', {
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

      this.drawProductionTableHeader(writer);

      for (const curtain of projection.curtains) {
        this.drawCurtainRow(writer, curtain);
      }

      writer.drawFooters();

      return await document.save();
    } catch (error) {
      throw new DocumentRenderError(error);
    }
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

  // Repeats the table header whenever a new page starts (D152).
  private drawProductionTableHeader(writer: DocumentWriter): void {
    writer.ensureSpace(TABLE_HEADER_HEIGHT + TABLE_LINE_HEIGHT);

    let x = MARGIN;

    for (const column of TABLE_COLUMNS) {
      writer.drawAt(
        column.label,
        x + TABLE_PADDING,
        writer.y - TABLE_PADDING - TABLE_FONT_SIZE,
        { bold: true, size: TABLE_FONT_SIZE },
      );
      x += column.width;
    }

    writer.advance(TABLE_HEADER_HEIGHT);
    writer.drawRule(writer.y);
  }

  private drawCurtainRow(
    writer: DocumentWriter,
    curtain: ProductionOrderCurtainProjection,
  ): void {
    const values = [
      String(curtain.sequence),
      curtain.room,
      curtain.description?.trim() ?? '',
      curtain.material,
      formatMeasure(curtain.finalWidth),
      formatMeasure(curtain.height),
    ];
    const cells = values.map((value, index) =>
      wrapText(
        value,
        writer.regularFont,
        TABLE_FONT_SIZE,
        TABLE_COLUMNS[index].width - TABLE_PADDING * 2,
      ),
    );
    const lineCount = Math.max(1, ...cells.map((lines) => lines.length));

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const isFirst = lineIndex === 0;
      const isLast = lineIndex === lineCount - 1;
      const required =
        TABLE_LINE_HEIGHT +
        (isFirst ? TABLE_PADDING : 0) +
        (isLast ? TABLE_PADDING : 0);

      if (!writer.hasSpace(required)) {
        writer.pageBreak();
        this.drawProductionTableHeader(writer);
      }

      if (isFirst) {
        writer.advance(TABLE_PADDING);
      }

      let x = MARGIN;

      cells.forEach((lines, columnIndex) => {
        const line = lines[lineIndex];

        if (line !== undefined) {
          writer.drawAt(line, x + TABLE_PADDING, writer.y - TABLE_FONT_SIZE, {
            size: TABLE_FONT_SIZE,
          });
        }

        x += TABLE_COLUMNS[columnIndex].width;
      });

      writer.advance(TABLE_LINE_HEIGHT);

      if (isLast) {
        writer.advance(TABLE_PADDING);
        writer.drawRule(writer.y);
      }
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
