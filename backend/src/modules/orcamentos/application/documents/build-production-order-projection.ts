import type { Curtain } from '../../domain/entities/curtain.js';
import type { Quote } from '../../domain/entities/quote.js';
import { DocumentDataIncompleteError } from '../errors/document-data-incomplete.error.js';
import type {
  ProductionOrderCurtainProjection,
  ProductionOrderProjection,
} from './document-projections.js';

// Builds the closed production order projection field by field (D169-D171).
// It never spreads Quote, QuoteDetailView or any other read model.
export function toProductionOrderProjection(
  quote: Quote,
): ProductionOrderProjection {
  const curtains = [...quote.curtains]
    .sort((left, right) => left.sequence - right.sequence)
    .map(toCurtainProjection);

  return {
    quoteNumber: quote.quoteNumber.value,
    curtains,
  };
}

function toCurtainProjection(
  curtain: Curtain,
): ProductionOrderCurtainProjection {
  const description = optionalText(curtain.description);

  return {
    sequence: curtain.sequence,
    room: requiredText(curtain.room),
    ...(description === undefined ? {} : { description }),
    material: requiredText(curtain.material),
    // D170: finalWidth is the domain getter; it is never recalculated here.
    finalWidth: requiredValue(curtain.finalWidth),
    height: requiredValue(curtain.height),
  };
}

function requiredText(value: string | null): string {
  if (value === null || value.trim() === '') {
    throw new DocumentDataIncompleteError();
  }

  return value.trim();
}

function requiredValue<T>(value: T | null): T {
  if (value === null) {
    throw new DocumentDataIncompleteError();
  }

  return value;
}

function optionalText(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}
