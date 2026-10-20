// Installation address Value Object owned by the Quote aggregate. It is a
// snapshot copied field by field from the customer when requested; changes to
// the customer address never mutate it. Partial values are allowed while the
// quote is a draft; the send gate requires isComplete().

export interface InstallationAddressInput {
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

export class InstallationAddress {
  private constructor(
    readonly postalCode: string | null,
    readonly street: string | null,
    readonly number: string | null,
    readonly complement: string | null,
    readonly neighborhood: string | null,
    readonly city: string | null,
    readonly state: string | null,
  ) {}

  static create(
    input: InstallationAddressInput | null | undefined,
  ): InstallationAddress | null {
    if (input === null || input === undefined) {
      return null;
    }

    const postalCode = normalizePostalCode(input.postalCode);

    if (postalCode !== null && !/^\d{8}$/.test(postalCode)) {
      throw new RangeError(
        'Installation address postal code must have exactly 8 digits',
      );
    }

    const state = normalizeState(input.state);

    if (state !== null && !/^[A-Z]{2}$/.test(state)) {
      throw new RangeError(
        'Installation address state must have exactly 2 uppercase letters',
      );
    }

    const address = new InstallationAddress(
      postalCode,
      normalizeText(input.street),
      normalizeText(input.number),
      normalizeText(input.complement),
      normalizeText(input.neighborhood),
      normalizeText(input.city),
      state,
    );

    return address.isEmpty() ? null : address;
  }

  isComplete(): boolean {
    return (
      this.street !== null &&
      this.number !== null &&
      this.neighborhood !== null &&
      this.city !== null
    );
  }

  equals(other: InstallationAddress | null): boolean {
    return (
      other !== null &&
      this.postalCode === other.postalCode &&
      this.street === other.street &&
      this.number === other.number &&
      this.complement === other.complement &&
      this.neighborhood === other.neighborhood &&
      this.city === other.city &&
      this.state === other.state
    );
  }

  private isEmpty(): boolean {
    return (
      this.postalCode === null &&
      this.street === null &&
      this.number === null &&
      this.complement === null &&
      this.neighborhood === null &&
      this.city === null &&
      this.state === null
    );
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}

function normalizePostalCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.replace(/\D/g, '');

  return normalized === '' ? null : normalized;
}

function normalizeState(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  return normalized === '' ? null : normalized;
}
