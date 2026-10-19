export function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOriginValues(env: NodeJS.ProcessEnv): string[] {
  return (env.APP_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function configuredOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const origins = configuredOriginValues(env)
    .map((value) => normalizeOrigin(value))
    .filter((origin): origin is string => origin !== null);

  return [...new Set(origins)];
}

export function assertConfiguredOrigins(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const values = configuredOriginValues(env);

  if (values.length === 0) {
    throw new Error(
      'APP_ORIGIN must be configured with at least one valid origin (for example, http://localhost:5173).',
    );
  }

  if (values.some((value) => normalizeOrigin(value) === null)) {
    throw new Error(
      'APP_ORIGIN contains an invalid origin. Use a comma-separated list of absolute origins.',
    );
  }
}
