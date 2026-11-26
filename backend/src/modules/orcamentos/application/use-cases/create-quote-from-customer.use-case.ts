import { Injectable } from '@nestjs/common';
import { Clock } from '../ports/clock.port.js';
import { CustomerEligibility } from '../ports/customer-eligibility.port.js';
import {
  Curtain,
  type CreateCurtainInput,
} from '../../domain/entities/curtain.js';
import type { FinancialItemInput } from '../../domain/entities/financial-item.js';
import { normalizeClientRef, Quote } from '../../domain/entities/quote.js';
import {
  QuoteValidationError,
  UnknownQuoteItemError,
} from '../../domain/errors/quote-domain.errors.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import {
  InstallationAddress,
  type InstallationAddressInput,
} from '../../domain/value-objects/installation-address.js';
import { commercialYearFrom } from '../../domain/value-objects/quote-number.js';
import { QuoteCustomerNotFoundError } from '../errors/quote-customer-not-found.error.js';
import { toDiscount, type QuoteDiscountInput } from './quote-discount-input.js';

// Creation input: the editable data of a first save (D79/D116). Curtain ids
// and sequences are not accepted; the aggregate generates them. A curtain
// created in the payload is referenced by `clientRef`, and an item created in
// the payload references it by `curtainRef`; the use case resolves the refs to
// the definitive ids the aggregate generated.
export type CreatableCurtainInput = Omit<CreateCurtainInput, 'sequence'> & {
  clientRef?: string | null;
  // Creation convenience: when informed, the use case adds a normal "Tecido"
  // financial item with the curtain's server-computed fabric quantity. The
  // domain remains unaware of the preset name.
  fabricUnitPriceCents?: number | null;
};

export type CreatableFinancialItemInput = Omit<
  FinancialItemInput,
  'curtainId'
> & {
  curtainRef?: string | null;
};

export interface CreateQuoteFromCustomerInput {
  customerId: string;
  notes?: string | null;
  discount?: QuoteDiscountInput | null;
  commercialAdjustmentCents?: number | null;
  installationAddress?: InstallationAddressInput | null;
  curtains?: CreatableCurtainInput[];
  financialItems?: CreatableFinancialItemInput[];
}

/**
 * First save of a quote created from a customer route (D78/D79). The number
 * is reserved and the aggregate, its children and QUOTE_CREATED are persisted
 * in one transaction by the repository (D80/D119).
 */
@Injectable()
export class CreateQuoteFromCustomerUseCase {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly customers: CustomerEligibility,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateQuoteFromCustomerInput): Promise<Quote> {
    if (!(await this.customers.existsAndIsActive(input.customerId))) {
      throw new QuoteCustomerNotFoundError();
    }

    const now = this.clock.now();
    const year = commercialYearFrom(now);
    const curtains = (input.curtains ?? []).map(toCurtain);
    const idsByRef = resolveCurtainRefs(input.curtains ?? [], curtains);

    return this.quotes.create(year, (quoteNumber) => ({
      quote: Quote.create({
        quoteNumber,
        customerId: input.customerId,
        createdAt: now,
        installationAddress: InstallationAddress.create(
          input.installationAddress,
        ),
        curtains,
        financialItems: [
          ...(input.financialItems ?? []).map((item) =>
            toFinancialItemInput(item, idsByRef),
          ),
          ...fabricItemsFor(input.curtains ?? [], curtains),
        ],
        discount: toDiscount(input.discount),
        commercialAdjustmentCents: input.commercialAdjustmentCents,
        notes: input.notes,
      }),
      event: {
        type: 'QUOTE_CREATED',
        details: QuoteHistoryDetails.created(quoteNumber.value),
      },
    }));
  }
}

function toCurtain(input: CreatableCurtainInput): Curtain {
  return Curtain.create({
    room: input.room,
    description: input.description,
    material: input.material,
    openingWidth: input.openingWidth,
    borderValue: input.borderValue,
    height: input.height,
    fabricFactor: input.fabricFactor,
    notes: input.notes,
  });
}

function resolveCurtainRefs(
  inputs: CreatableCurtainInput[],
  curtains: Curtain[],
): Map<string, string> {
  const idsByRef = new Map<string, string>();

  inputs.forEach((input, index) => {
    const ref = normalizeClientRef(input.clientRef);

    if (ref === undefined) {
      return;
    }

    if (idsByRef.has(ref)) {
      throw new UnknownQuoteItemError('Duplicate curtain clientRef');
    }

    idsByRef.set(ref, curtains[index].id);
  });

  return idsByRef;
}

function toFinancialItemInput(
  item: CreatableFinancialItemInput,
  idsByRef: ReadonlyMap<string, string>,
): FinancialItemInput {
  const ref = normalizeClientRef(item.curtainRef);
  const curtainId = ref === undefined ? null : idsByRef.get(ref);

  if (curtainId === undefined) {
    throw new UnknownQuoteItemError('Unknown curtainRef');
  }

  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    curtainId,
  };
}

// The fabric price is an explicit creation input, not an automatic fee: the
// application layer turns it into an ordinary "Tecido" item whose quantity is
// the fabric quantity the domain derives from the curtain measures. The item
// remains the single source of truth and can be edited like any other item.
function fabricItemsFor(
  inputs: CreatableCurtainInput[],
  curtains: Curtain[],
): FinancialItemInput[] {
  return inputs.flatMap((input, index) => {
    if (input.fabricUnitPriceCents == null) {
      return [];
    }

    const curtain = curtains[index];

    if (curtain.fabricQuantity === null) {
      throw new QuoteValidationError([
        {
          code: 'CURTAIN_FABRIC_QUANTITY_REQUIRED',
          message: `Curtain ${index + 1} needs an opening width and fabric factor to apply a fabric price`,
        },
      ]);
    }

    return [
      {
        name: FABRIC_ITEM_NAME,
        quantity: curtain.fabricQuantity,
        unit: FABRIC_ITEM_UNIT,
        unitPriceCents: input.fabricUnitPriceCents,
        curtainId: curtain.id,
      },
    ];
  });
}

const FABRIC_ITEM_NAME = 'Tecido';
const FABRIC_ITEM_UNIT = 'm';
