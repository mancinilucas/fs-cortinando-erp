import { Injectable } from '@nestjs/common';
import { Curtain } from '../../domain/entities/curtain.js';
import type { FinancialItemPatch } from '../../domain/entities/financial-item.js';
import {
  normalizeClientRef,
  type Quote,
  type QuoteCurtainPatch,
  type QuotePatch,
} from '../../domain/entities/quote.js';
import {
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../../domain/errors/quote-domain.errors.js';
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
// `fabricUnitPriceCents` is a creation convenience for a new curtain: the use
// case adds a normal "Tecido" item with the fabric quantity derived by the
// domain. Existing curtains edit that item through `financialItems`.
export type UpdateCurtainInput = QuoteCurtainPatch & {
  fabricUnitPriceCents?: number | null;
};

export interface UpdateQuoteInput {
  id: string;
  installationAddress?: InstallationAddressInput | null;
  discount?: QuoteDiscountInput | null;
  commercialAdjustmentCents?: number | null;
  notes?: string | null;
  curtains?: UpdateCurtainInput[];
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
      const patch = toQuotePatch(input);
      appendFabricItems(patch, input);

      quote.applyPatch(patch);

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
    patch.curtains = input.curtains.map((curtain) => ({
      id: curtain.id,
      clientRef: curtain.clientRef,
      room: curtain.room,
      description: curtain.description,
      material: curtain.material,
      openingWidth: curtain.openingWidth,
      borderValue: curtain.borderValue,
      height: curtain.height,
      fabricFactor: curtain.fabricFactor,
      notes: curtain.notes,
    }));
  }

  if (input.financialItems !== undefined) {
    patch.financialItems = input.financialItems;
  }

  return patch;
}

const FABRIC_ITEM_NAME = 'Tecido';
const FABRIC_ITEM_UNIT = 'm';

// Adds the "Tecido" item requested by a new curtain's explicit fabric price.
// The quantity comes from the domain's curtain calculation, never from the
// client. A sent `financialItems` array must accompany the convenience so the
// aggregate can reconcile the complete collection instead of dropping it.
function appendFabricItems(patch: QuotePatch, input: UpdateQuoteInput): void {
  const fabricPatches = (input.curtains ?? []).flatMap(
    (curtain): FinancialItemPatch[] => {
      if (curtain.fabricUnitPriceCents == null) {
        return [];
      }

      if (curtain.id !== undefined && curtain.id !== null) {
        throw new UnknownQuoteItemError(
          'Fabric price is only accepted for new curtains',
        );
      }

      const clientRef = normalizeClientRef(curtain.clientRef);

      if (clientRef === undefined) {
        throw new UnknownQuoteItemError(
          'Fabric price requires a clientRef on a new curtain',
        );
      }

      const created = Curtain.create({
        room: curtain.room,
        description: curtain.description,
        material: curtain.material,
        openingWidth: curtain.openingWidth,
        borderValue: curtain.borderValue,
        height: curtain.height,
        fabricFactor: curtain.fabricFactor,
        notes: curtain.notes,
      });

      if (created.fabricQuantity === null) {
        throw new QuoteValidationError([
          {
            code: 'CURTAIN_FABRIC_QUANTITY_REQUIRED',
            message:
              'Curtain needs an opening width and fabric factor to apply a fabric price',
          },
        ]);
      }

      return [
        {
          curtainRef: clientRef,
          name: FABRIC_ITEM_NAME,
          quantity: created.fabricQuantity,
          unit: FABRIC_ITEM_UNIT,
          unitPriceCents: curtain.fabricUnitPriceCents,
        },
      ];
    },
  );

  if (fabricPatches.length === 0) {
    return;
  }

  if (patch.financialItems === undefined) {
    throw new UnknownQuoteItemError(
      'Financial items are required when adding a fabric price to a new curtain',
    );
  }

  patch.financialItems = [...patch.financialItems, ...fabricPatches];
}
