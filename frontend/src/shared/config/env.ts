export function readApiBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

export const apiBaseUrl = readApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
