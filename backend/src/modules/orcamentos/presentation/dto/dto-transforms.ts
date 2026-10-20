// Presentation transforms shared by the quote DTOs (D116). They only
// normalize the JSON shape; class-validator still decides whether the result
// is structurally acceptable, so a malformed value is never coerced silently.

export function trimOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}

// Mirrors the InstallationAddress normalization (D94): non-digits are
// stripped and an empty value becomes null.
export function normalizePostalCode(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.replace(/\D/g, '');

  return normalized === '' ? null : normalized;
}

export function normalizeState(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toUpperCase();

  return normalized === '' ? null : normalized;
}

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

// Dates travel as ISO 8601 strings and become Date instances for the use
// cases. A string outside the format is left untouched so @IsDate rejects it
// instead of JavaScript parsing it leniently.
export function toDate(value: unknown): unknown {
  if (typeof value !== 'string' || !ISO_8601_PATTERN.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed;
}
