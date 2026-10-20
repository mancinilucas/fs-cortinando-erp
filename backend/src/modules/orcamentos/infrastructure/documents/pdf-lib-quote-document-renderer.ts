import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type {
  CommercialPdfProjection,
  ProductionOrderProjection,
} from '../../application/documents/document-projections.js';
import { QuoteDocumentRenderer } from '../../application/documents/quote-document-renderer.js';
import { DocumentRenderError } from '../../application/errors/document-render.error.js';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;

// Initial pdf-lib adapter (DOCUMENTOS-13). It validates ESM, Node runtime,
// Uint8Array output, Helvetica and pt-BR characters; the full layouts arrive
// in DOCUMENTOS-15/16. Only this file imports pdf-lib (D197).
@Injectable()
export class PdfLibQuoteDocumentRenderer extends QuoteDocumentRenderer {
  async renderCommercialPdf(
    projection: CommercialPdfProjection,
  ): Promise<Uint8Array> {
    return this.renderPlaceholder(projection.quoteNumber);
  }

  async renderProductionOrder(
    projection: ProductionOrderProjection,
  ): Promise<Uint8Array> {
    return this.renderPlaceholder(projection.quoteNumber);
  }

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
