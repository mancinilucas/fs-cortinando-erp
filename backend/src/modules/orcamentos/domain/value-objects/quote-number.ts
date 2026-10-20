// Canonical commercial quote number: ORÇ-AAAA-NNN.
// The VO validates and exposes the value; persistence, locking and the clock
// stay outside the domain.

const QUOTE_NUMBER_PATTERN = /^ORÇ-(\d{4})-(\d{3,})$/;
const COMMERCIAL_TIME_ZONE = 'America/Sao_Paulo';
const MIN_SEQUENCE = 1;
const MAX_SEQUENCE = 2_147_483_647;

const commercialYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMMERCIAL_TIME_ZONE,
  year: 'numeric',
});

export class QuoteNumber {
  private constructor(
    readonly value: string,
    readonly year: number,
    readonly sequence: number,
  ) {}

  static create(year: number, sequence: number): QuoteNumber {
    assertYear(year);
    assertSequence(sequence);

    return new QuoteNumber(formatQuoteNumber(year, sequence), year, sequence);
  }

  static parse(value: string): QuoteNumber {
    const match = QUOTE_NUMBER_PATTERN.exec(value);

    if (match === null) {
      throw new Error('Invalid quote number format');
    }

    return QuoteNumber.create(Number(match[1]), Number(match[2]));
  }

  equals(other: QuoteNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export function formatQuoteNumber(year: number, sequence: number): string {
  assertYear(year);
  assertSequence(sequence);

  return `ORÇ-${String(year).padStart(4, '0')}-${String(sequence).padStart(3, '0')}`;
}

// The commercial year is the calendar year in America/Sao_Paulo. This helper
// is pure: it converts a provided instant and never reads the current clock.
export function commercialYearFrom(instant: Date): number {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Invalid instant');
  }

  return Number(commercialYearFormatter.format(instant));
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9_999) {
    throw new RangeError('Quote number year must be a four-digit year');
  }
}

function assertSequence(sequence: number): void {
  if (
    !Number.isInteger(sequence) ||
    sequence < MIN_SEQUENCE ||
    sequence > MAX_SEQUENCE
  ) {
    throw new RangeError('Quote number sequence must be a positive integer');
  }
}
