import type { FinancialItem } from '../entities/financial-item.js';
import type { Quote } from '../entities/quote.js';
import type { QuoteEditChange } from './quote-history.js';

// Pure diff of the editable state of a Quote (D109). The Application captures
// the state before applying a patch and diffs it afterwards; an empty result
// means the save produced no effective change and must not create history.

export interface QuoteItemState {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
}

export interface QuoteCurtainState {
  id: string;
  sequence: number;
  room: string | null;
  description: string | null;
  material: string | null;
  openingWidth: number | null;
  borderValue: number | null;
  height: number | null;
  fabricFactor: number | null;
  notes: string | null;
  components: QuoteItemState[];
}

export interface QuoteAddressState {
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface QuoteEditableState {
  installationAddress: QuoteAddressState | null;
  discountType: string;
  discountPercentage: number | null;
  discountFixedAmountCents: number | null;
  commercialAdjustmentCents: number | null;
  notes: string | null;
  curtains: QuoteCurtainState[];
  generalAddOns: QuoteItemState[];
}

type CurtainLocator = Pick<QuoteEditChange, 'curtainSequence' | 'curtainRoom'>;

export function captureEditableState(quote: Quote): QuoteEditableState {
  return {
    installationAddress:
      quote.installationAddress === null
        ? null
        : {
            postalCode: quote.installationAddress.postalCode,
            street: quote.installationAddress.street,
            number: quote.installationAddress.number,
            complement: quote.installationAddress.complement,
            neighborhood: quote.installationAddress.neighborhood,
            city: quote.installationAddress.city,
            state: quote.installationAddress.state,
          },
    discountType: quote.discount.type,
    discountPercentage: quote.discount.percentage,
    discountFixedAmountCents: quote.discount.fixedAmountCents,
    commercialAdjustmentCents: quote.commercialAdjustmentCents,
    notes: quote.notes,
    curtains: quote.curtains.map((curtain) => ({
      id: curtain.id,
      sequence: curtain.sequence,
      room: curtain.room,
      description: curtain.description,
      material: curtain.material,
      openingWidth: curtain.openingWidth,
      borderValue: curtain.borderValue,
      height: curtain.height,
      fabricFactor: curtain.fabricFactor,
      notes: curtain.notes,
      components: curtain.components.map(captureItem),
    })),
    generalAddOns: quote.generalAddOns.map(captureItem),
  };
}

export function diffEditableState(
  before: QuoteEditableState,
  after: QuoteEditableState,
): QuoteEditChange[] {
  const changes: QuoteEditChange[] = [];

  pushAddressChanges(
    changes,
    before.installationAddress,
    after.installationAddress,
  );
  pushChange(changes, 'discountType', before.discountType, after.discountType);
  pushChange(
    changes,
    'discountPercentage',
    before.discountPercentage,
    after.discountPercentage,
  );
  pushChange(
    changes,
    'discountFixedAmountCents',
    before.discountFixedAmountCents,
    after.discountFixedAmountCents,
  );
  pushChange(
    changes,
    'commercialAdjustmentCents',
    before.commercialAdjustmentCents,
    after.commercialAdjustmentCents,
  );
  pushChange(changes, 'notes', before.notes, after.notes);

  pushCurtainChanges(changes, before.curtains, after.curtains);
  pushGeneralAddOnChanges(changes, before.generalAddOns, after.generalAddOns);

  return changes;
}

function captureItem(item: FinancialItem): QuoteItemState {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
  };
}

function pushAddressChanges(
  changes: QuoteEditChange[],
  before: QuoteAddressState | null,
  after: QuoteAddressState | null,
): void {
  pushChange(
    changes,
    'installationAddress.postalCode',
    before?.postalCode ?? null,
    after?.postalCode ?? null,
  );
  pushChange(
    changes,
    'installationAddress.street',
    before?.street ?? null,
    after?.street ?? null,
  );
  pushChange(
    changes,
    'installationAddress.number',
    before?.number ?? null,
    after?.number ?? null,
  );
  pushChange(
    changes,
    'installationAddress.complement',
    before?.complement ?? null,
    after?.complement ?? null,
  );
  pushChange(
    changes,
    'installationAddress.neighborhood',
    before?.neighborhood ?? null,
    after?.neighborhood ?? null,
  );
  pushChange(
    changes,
    'installationAddress.city',
    before?.city ?? null,
    after?.city ?? null,
  );
  pushChange(
    changes,
    'installationAddress.state',
    before?.state ?? null,
    after?.state ?? null,
  );
}

function pushCurtainChanges(
  changes: QuoteEditChange[],
  before: QuoteCurtainState[],
  after: QuoteCurtainState[],
): void {
  const beforeById = new Map(before.map((curtain) => [curtain.id, curtain]));

  for (const curtain of after) {
    const previous = beforeById.get(curtain.id);
    const locator: CurtainLocator = {
      curtainSequence: curtain.sequence,
      curtainRoom: curtain.room,
    };

    if (previous === undefined) {
      changes.push({
        field: 'curtain',
        previous: null,
        next: curtain.room,
        ...locator,
      });
    } else {
      pushChange(
        changes,
        'sequence',
        previous.sequence,
        curtain.sequence,
        locator,
      );
      pushChange(changes, 'room', previous.room, curtain.room, locator);
      pushChange(
        changes,
        'description',
        previous.description,
        curtain.description,
        locator,
      );
      pushChange(
        changes,
        'material',
        previous.material,
        curtain.material,
        locator,
      );
      pushChange(
        changes,
        'openingWidth',
        previous.openingWidth,
        curtain.openingWidth,
        locator,
      );
      pushChange(
        changes,
        'borderValue',
        previous.borderValue,
        curtain.borderValue,
        locator,
      );
      pushChange(changes, 'height', previous.height, curtain.height, locator);
      pushChange(
        changes,
        'fabricFactor',
        previous.fabricFactor,
        curtain.fabricFactor,
        locator,
      );
      pushChange(changes, 'notes', previous.notes, curtain.notes, locator);
    }

    pushComponentChanges(changes, previous?.components ?? [], curtain, locator);
  }

  const afterIds = new Set(after.map((curtain) => curtain.id));

  for (const curtain of before) {
    if (!afterIds.has(curtain.id)) {
      changes.push({
        field: 'curtain',
        previous: curtain.room,
        next: null,
        curtainSequence: curtain.sequence,
        curtainRoom: curtain.room,
      });
    }
  }
}

function pushComponentChanges(
  changes: QuoteEditChange[],
  before: QuoteItemState[],
  curtain: QuoteCurtainState,
  locator: CurtainLocator,
): void {
  const beforeById = new Map(
    before.map((component) => [component.id, component]),
  );
  const afterIds = new Set(curtain.components.map((component) => component.id));

  for (const component of curtain.components) {
    const previous = beforeById.get(component.id);
    const componentLocator = {
      ...locator,
      componentName: component.name,
    };

    if (previous === undefined) {
      changes.push({
        field: 'component',
        previous: null,
        next: component.name,
        ...componentLocator,
      });
    } else {
      pushChange(
        changes,
        'name',
        previous.name,
        component.name,
        componentLocator,
      );
      pushChange(
        changes,
        'quantity',
        previous.quantity,
        component.quantity,
        componentLocator,
      );
      pushChange(
        changes,
        'unit',
        previous.unit,
        component.unit,
        componentLocator,
      );
      pushChange(
        changes,
        'unitPriceCents',
        previous.unitPriceCents,
        component.unitPriceCents,
        componentLocator,
      );
    }
  }

  for (const component of before) {
    if (!afterIds.has(component.id)) {
      changes.push({
        field: 'component',
        previous: component.name,
        next: null,
        ...locator,
        componentName: component.name,
      });
    }
  }
}

function pushGeneralAddOnChanges(
  changes: QuoteEditChange[],
  before: QuoteItemState[],
  after: QuoteItemState[],
): void {
  const beforeById = new Map(before.map((addOn) => [addOn.id, addOn]));
  const afterIds = new Set(after.map((addOn) => addOn.id));

  for (const addOn of after) {
    const previous = beforeById.get(addOn.id);

    if (previous === undefined) {
      changes.push({
        field: 'generalAddOn',
        previous: null,
        next: addOn.name,
      });
    } else {
      pushChange(changes, 'name', previous.name, addOn.name);
      pushChange(changes, 'quantity', previous.quantity, addOn.quantity);
      pushChange(changes, 'unit', previous.unit, addOn.unit);
      pushChange(
        changes,
        'unitPriceCents',
        previous.unitPriceCents,
        addOn.unitPriceCents,
      );
    }
  }

  for (const addOn of before) {
    if (!afterIds.has(addOn.id)) {
      changes.push({
        field: 'generalAddOn',
        previous: addOn.name,
        next: null,
      });
    }
  }
}

function pushChange(
  changes: QuoteEditChange[],
  field: string,
  previous: string | number | boolean | null,
  next: string | number | boolean | null,
  locator?: CurtainLocator,
): void {
  if (previous === next) {
    return;
  }

  changes.push({ field, previous, next, ...locator });
}
