// Closed projections for Phase 8 documents (D143/D146/D158). Only the fields
// explicitly authorized for each document are present. The renderer never
// receives the Quote aggregate or the internal QuoteDetailView.

export interface BusinessIdentityProjection {
  commercialNameOrConsultant: string;
  phone: string;
  email?: string;
  taxId?: string;
}

export interface CustomerContactProjection {
  name: string;
  phone: string;
}

// D161: the renderer composes `{room} — {description} — Cortina sob medida`,
// omitting the description segment when absent. No price, measurement,
// material or quantity belongs to a commercial service line.
export interface CommercialServiceLineProjection {
  room: string;
  description?: string;
}

// D159-D168. A DRAFT preview omits totalCents when it is zero and validUntil
// while it is null; generation states require both, enforced by the use case.
export interface CommercialPdfProjection {
  quoteNumber: string;
  businessIdentity: BusinessIdentityProjection;
  customer: CustomerContactProjection;
  serviceLines: CommercialServiceLineProjection[];
  totalCents?: number;
  validUntil?: Date;
}

// D169-D171. Only the technical data needed for production. No customer,
// business identity, derivation inputs, financial data or internal notes.
export interface ProductionOrderCurtainProjection {
  sequence: number;
  room: string;
  description?: string;
  material: string;
  finalWidth: number;
  height: number;
}

export interface ProductionOrderProjection {
  quoteNumber: string;
  curtains: ProductionOrderCurtainProjection[];
}
