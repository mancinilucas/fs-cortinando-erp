import {
  normalizeCustomerOptionalText,
  normalizeCustomerPostalCode,
  normalizeCustomerState,
} from '../customer-normalizers.js';

export interface CustomerAddressInput {
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

// Customer address Value Object (D53–D55). A null result from create()
// represents the complete absence of an address; a present address always has
// street, number, neighborhood and city (D54-A).
export class CustomerAddress {
  private constructor(
    readonly postalCode: string | null,
    readonly street: string,
    readonly number: string,
    readonly complement: string | null,
    readonly neighborhood: string,
    readonly city: string,
    readonly state: string | null,
  ) {}

  static create(
    input: CustomerAddressInput | null | undefined,
  ): CustomerAddress | null {
    if (input === null || input === undefined) {
      return null;
    }

    const street = normalizeCustomerOptionalText(input.street);
    const number = normalizeCustomerOptionalText(input.number);
    const neighborhood = normalizeCustomerOptionalText(input.neighborhood);
    const city = normalizeCustomerOptionalText(input.city);

    if (
      street === null ||
      number === null ||
      neighborhood === null ||
      city === null
    ) {
      throw new Error(
        'Customer address requires street, number, neighborhood and city',
      );
    }

    const postalCode = normalizeCustomerPostalCode(input.postalCode);

    if (postalCode !== null && !/^\d{8}$/.test(postalCode)) {
      throw new Error(
        'Customer address postal code must have exactly 8 digits',
      );
    }

    const state = normalizeCustomerState(input.state);

    if (state !== null && !/^[A-Z]{2}$/.test(state)) {
      throw new Error(
        'Customer address state must have exactly 2 uppercase letters',
      );
    }

    return new CustomerAddress(
      postalCode,
      street,
      number,
      normalizeCustomerOptionalText(input.complement),
      neighborhood,
      city,
      state,
    );
  }
}
