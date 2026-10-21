function hasUnsafeCharacters(value: string) {
  return [...value].some((character) => character === '\\' || /\s/.test(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

// Accept only same-origin paths and reject normalized or encoded redirect targets.
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacters(value)) return '/dashboard'
  try {
    const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0])
    if (decoded.startsWith('//') || hasUnsafeCharacters(decoded)) return '/dashboard'
    const url = new URL(value, 'https://app.invalid')
    const normalizedPath = decodeURIComponent(url.pathname)
    if (url.origin !== 'https://app.invalid' || normalizedPath.startsWith('//') || hasUnsafeCharacters(normalizedPath)
      || /^\/login\/*$/i.test(normalizedPath)) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/dashboard' }
}
