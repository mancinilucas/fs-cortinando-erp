import { normalizeEmail } from '../../../shared/text/normalize-email.js';

// Technical normalizations for customer fields (D47–D55). They only adapt
// representation and are deterministic and idempotent; format and business
// validation belong to the value objects and the aggregate.

export function normalizeCustomerName(value: string): string {
  return value.trim().normalize('NFC');
}

export function normalizeCustomerPhone(value: string): string {
  return value.trim();
}

export function normalizeCustomerEmail(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, normalizeEmail);
}

export function normalizeCustomerTaxId(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, onlyDigits);
}

export function normalizeCustomerPostalCode(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, onlyDigits);
}

export function normalizeCustomerState(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, (state) => state.trim().toUpperCase());
}

export function normalizeCustomerOptionalText(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, (text) => text.trim());
}

function normalizeOptional(
  value: string | null | undefined,
  normalize: (value: string) => string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalize(value);

  return normalized === '' ? null : normalized;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}
