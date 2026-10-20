import type { Curtain } from '../../domain/entities/curtain.js';
import { QuoteStatus, type Quote } from '../../domain/entities/quote.js';
import type {
  BusinessIdentityProjection,
  CommercialPdfProjection,
  CommercialServiceLineProjection,
  CustomerContactProjection,
} from './document-projections.js';

// Inputs are the only data the commercial document may read (D159-D168). The
// business identity shape mirrors BusinessDataValues without importing the
// other module or exposing its updatedAt.
export interface CommercialPdfProjectionInput {
  quote: Quote;
  businessIdentity: {
    commercialNameOrConsultant: string;
    phone: string;
    email: string | null;
    taxId: string | null;
  };
  customer: CustomerContactProjection;
}

// Builds the closed commercial projection field by field (D158). It never
// spreads Quote, QuoteDetailView or any other read model.
export function toCommercialPdfProjection(
  input: CommercialPdfProjectionInput,
): CommercialPdfProjection {
  const { quote, businessIdentity, customer } = input;
  const serviceLines = quote.curtains
    .map(toServiceLine)
    .filter((line): line is CommercialServiceLineProjection => line !== null);

  // D165: a DRAFT preview omits a zero total. Generation states always carry a
  // positive total, enforced by the send gate.
  const totalCents =
    quote.status === QuoteStatus.DRAFT && quote.totalCents === 0
      ? undefined
      : quote.totalCents;

  return {
    quoteNumber: quote.quoteNumber.value,
    businessIdentity: toBusinessIdentity(businessIdentity),
    customer: { name: customer.name, phone: customer.phone },
    serviceLines,
    ...(totalCents === undefined ? {} : { totalCents }),
    // D164: the preview omits a null validity; generation states require it.
    ...(quote.validUntil === null ? {} : { validUntil: quote.validUntil }),
  };
}

function toBusinessIdentity(input: {
  commercialNameOrConsultant: string;
  phone: string;
  email: string | null;
  taxId: string | null;
}): BusinessIdentityProjection {
  const email = optionalText(input.email);
  const taxId = optionalText(input.taxId);

  return {
    commercialNameOrConsultant: input.commercialNameOrConsultant,
    phone: input.phone,
    ...(email === undefined ? {} : { email }),
    ...(taxId === undefined ? {} : { taxId }),
  };
}

// D161: a curtain without an environment has no representable service line,
// so the DRAFT preview shows only the curtains that already have a room. The
// use case enforces the D165 minimum of at least one line.
function toServiceLine(
  curtain: Curtain,
): CommercialServiceLineProjection | null {
  if (curtain.room === null) {
    return null;
  }

  const description = optionalText(curtain.description);

  return description === undefined
    ? { room: curtain.room }
    : { room: curtain.room, description };
}

function optionalText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}
