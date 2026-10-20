import { Injectable } from '@nestjs/common';
import { Clock } from '../ports/clock.port.js';
import { CustomerEligibility } from '../ports/customer-eligibility.port.js';
import {
  Curtain,
  type CreateCurtainInput,
} from '../../domain/entities/curtain.js';
import {
  FinancialItem,
  type FinancialItemInput,
} from '../../domain/entities/financial-item.js';
import { Quote } from '../../domain/entities/quote.js';
import { QuoteHistoryDetails } from '../../domain/history/quote-history.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { Discount, DiscountType } from '../../domain/value-objects/discount.js';
import {
  InstallationAddress,
  type InstallationAddressInput,
} from '../../domain/value-objects/installation-address.js';
import { commercialYearFrom } from '../../domain/value-objects/quote-number.js';
import { QuoteCustomerNotFoundError } from '../errors/quote-customer-not-found.error.js';

// Creation input: the editable data of a first save (D79/D116). Ids and
// sequence are not accepted; the aggregate generates them.
export type CreatableCurtainInput = Omit<
  CreateCurtainInput,
  'sequence' | 'components'
> & {
  components?: FinancialItemInput[];
};

export type QuoteDiscountInput =
  | {
      type: DiscountType.NO_DISCOUNT;
      percentage?: null;
      fixedAmountCents?: null;
    }
  | {
      type: DiscountType.PERCENTAGE;
      percentage: number;
      fixedAmountCents?: null;
    }
  | {
      type: DiscountType.FIXED_AMOUNT;
      percentage?: null;
      fixedAmountCents: number;
    };

export interface CreateQuoteFromCustomerInput {
  customerId: string;
  notes?: string | null;
  discount?: QuoteDiscountInput | null;
  commercialAdjustmentCents?: number | null;
  installationAddress?: InstallationAddressInput | null;
  curtains?: CreatableCurtainInput[];
  generalAddOns?: FinancialItemInput[];
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

    return this.quotes.create(year, (quoteNumber) => ({
      quote: Quote.create({
        quoteNumber,
        customerId: input.customerId,
        createdAt: now,
        installationAddress: InstallationAddress.create(
          input.installationAddress,
        ),
        curtains: (input.curtains ?? []).map(toCurtain),
        generalAddOns: (input.generalAddOns ?? []).map((item) =>
          FinancialItem.create(item),
        ),
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
    components: (input.components ?? []).map((item) =>
      FinancialItem.create(item),
    ),
  });
}

function toDiscount(input: QuoteDiscountInput | null | undefined): Discount {
  if (input === null || input === undefined) {
    return Discount.noDiscount();
  }

  switch (input.type) {
    case DiscountType.NO_DISCOUNT:
      return Discount.noDiscount();
    case DiscountType.PERCENTAGE:
      return Discount.percentage(input.percentage);
    case DiscountType.FIXED_AMOUNT:
      return Discount.fixedAmount(input.fixedAmountCents);
  }
}
