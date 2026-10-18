export function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function configuredOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const values = (env.APP_ORIGIN ?? '').split(',');
  const origins = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeOrigin(value))
    .filter((origin): origin is string => origin !== null);

  return [...new Set(origins)];
}
