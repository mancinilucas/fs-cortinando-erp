// D192: filenames derive only from the quote number. The ASCII fallback keeps
// the header safe; filename* preserves the original value (for example, the
// "Ç" in "ORÇ-2026-001") per RFC 5987.
export type DocumentFileKind = 'commercial-pdf' | 'production-order';

const PREFIXES: Record<DocumentFileKind, string> = {
  'commercial-pdf': 'orcamento',
  'production-order': 'ordem-de-producao',
};

export function buildContentDisposition(
  kind: DocumentFileKind,
  quoteNumber: string,
): string {
  const fallback = `${PREFIXES[kind]}-${toAscii(quoteNumber)}.pdf`;
  const original = `${PREFIXES[kind]}-${quoteNumber}.pdf`;

  if (fallback === original) {
    return `inline; filename="${fallback}"`;
  }

  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(original)}`;
}

function toAscii(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return ascii === '' ? 'documento' : ascii;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
