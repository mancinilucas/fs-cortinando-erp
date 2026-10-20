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
// means unchanged; null clears scalar values where absence is allowed; a sent
// collection is the complete state and is reconciled by id.
export interface UpdateQuoteInput {
  id: string;
  installationAddress?: InstallationAddressInput | null;
  discount?: QuoteDiscountInput | null;
  commercialAdjustmentCents?: number | null;
  notes?: string | null;
  curtains?: QuoteCurtainPatch[];
  generalAddOns?: FinancialItemPatch[];
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
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    const before = captureEditableState(quote);

    quote.applyPatch(toQuotePatch(input));

    const changes = diffEditableState(before, captureEditableState(quote));

    if (changes.length === 0) {
      return quote;
    }

    await this.quotes.save(quote, {
      type: 'QUOTE_EDITED',
      details: QuoteHistoryDetails.edited(changes),
    });

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

  if (input.generalAddOns !== undefined) {
    patch.generalAddOns = input.generalAddOns;
  }

  return patch;
}
