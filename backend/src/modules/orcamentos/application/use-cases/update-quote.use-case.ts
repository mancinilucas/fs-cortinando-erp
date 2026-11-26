import { Injectable } from '@nestjs/common';
import type { FinancialItemPatch } from '../../domain/entities/financial-item.js';
import type {
  Quote,
  QuoteCurtainPatch,
  QuotePatch,
} from '../../domain/entities/quote.js';
import {
  captureEditableState,
  diffEditableState,
} from '../../domain/history/quote-diff.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import {
  InstallationAddress,
  type InstallationAddressInput,
} from '../../domain/value-objects/installation-address.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { toDiscount, type QuoteDiscountInput } from './quote-discount-input.js';

// Editable payload of a PATCH (D116/D117). Every field is optional: omitted
// means unchanged; null clears scalar values where absence is allowed. The
// financial composition is one collection (PROJECT_SPEC §2.4-2.5): a sent
// `financialItems` array is the complete state, reconciled by id, and an item
// may change its `curtainId` to move between a curtain and the general
// composition of the same quote.
export interface UpdateQuoteInput {
  id: string;
  installationAddress?: InstallationAddressInput | null;
  discount?: QuoteDiscountInput | null;
  commercialAdjustmentCents?: number | null;
  notes?: string | null;
  curtains?: QuoteCurtainPatch[];
  financialItems?: FinancialItemPatch[];
}

/**
 * Applies an edit to a DRAFT or SENT quote, including an expired one (D117).
 * The aggregate is saved and exactly one QUOTE_EDITED is recorded only when
 * the patch changes the editable state; a no-op produces no history noise.
 */
@Injectable()
export class UpdateQuoteUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: UpdateQuoteInput): Promise<Quote> {
    const quote = await this.quotes.mutate(input.id, (quote) => {
      const before = captureEditableState(quote);

      quote.applyPatch(toQuotePatch(input));

      const changes = diffEditableState(before, captureEditableState(quote));

      if (changes.length === 0) {
        return null;
      }

      return {
        type: 'QUOTE_EDITED',
        details: QuoteHistoryDetails.edited(changes),
      };
    });

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return quote;
  }
}

function toQuotePatch(input: UpdateQuoteInput): QuotePatch {
  const patch: QuotePatch = {};

  if (input.installationAddress !== undefined) {
    patch.installationAddress = InstallationAddress.create(
      input.installationAddress,
    );
  }

  if (input.discount !== undefined) {
    patch.discount = toDiscount(input.discount);
  }

  if (input.commercialAdjustmentCents !== undefined) {
    patch.commercialAdjustmentCents = input.commercialAdjustmentCents;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.curtains !== undefined) {
    patch.curtains = input.curtains;
  }

  if (input.financialItems !== undefined) {
    patch.financialItems = input.financialItems;
  }

  return patch;
}
