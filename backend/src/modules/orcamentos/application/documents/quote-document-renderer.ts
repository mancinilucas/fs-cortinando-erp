import type {
  CommercialPdfProjection,
  ProductionOrderProjection,
} from './document-projections.js';

// Application port for Phase 8 document rendering (D147/D197). The Application
// coordinates projections and history; Infrastructure owns the PDF library.
// Implementations return bytes in memory and never persist a file (D144).

export abstract class QuoteDocumentRenderer {
  abstract renderCommercialPdf(
    projection: CommercialPdfProjection,
  ): Promise<Uint8Array>;

  abstract renderProductionOrder(
    projection: ProductionOrderProjection,
  ): Promise<Uint8Array>;
}
