import { normalizeEmail } from '../../../shared/text/normalize-email.js';
import type { BusinessDataValues } from './business-data-store.js';

export interface BusinessDataInput {
  commercialNameOrConsultant?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
}

// Technical normalizations for the business configuration (D132). They only
// adapt representation and are deterministic and idempotent; required-field
// and format validation belong to the update use case and the DTO.
export function normalizeBusinessDataValues(
  input: BusinessDataInput,
): BusinessDataValues {
  return {
    commercialNameOrConsultant: normalizeRequiredText(
      input.commercialNameOrConsultant,
    ),
    phone: normalizeRequiredText(input.phone),
    email: normalizeOptional(input.email, normalizeEmail),
    taxId: normalizeOptional(input.taxId, onlyDigits),
  };
}

export function normalizeBusinessDataName(
  value: string | null | undefined,
): string {
  return normalizeRequiredText(value);
}

export function normalizeBusinessDataPhone(
  value: string | null | undefined,
): string {
  return normalizeRequiredText(value);
}

export function normalizeBusinessDataEmail(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, normalizeEmail);
}

export function normalizeBusinessDataTaxId(
  value: string | null | undefined,
): string | null {
  return normalizeOptional(value, onlyDigits);
}

function normalizeRequiredText(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.trim().normalize('NFC');
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
