type FieldNormalizer = (value: string) => string | null;

// Applies the domain normalization to string inputs and leaves other JSON
// types untouched so class-validator can report a clear 400.
export function normalizeString(
  value: unknown,
  normalize: FieldNormalizer,
): unknown {
  return typeof value === 'string' ? normalize(value) : value;
}
