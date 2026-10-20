// Visual formatting for generated documents only (D151/D172). These helpers
// never persist or mutate the source values.
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const measureFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

// PDF standard fonts encode WinAnsi; a regular space renders reliably where
// Intl may emit a non-breaking space.
const NON_BREAKING_SPACES = /[  ]/g;

// Amounts travel in integer cents throughout the backend.
export function formatCurrency(cents: number): string {
  return currencyFormatter
    .format(cents / 100)
    .replace(NON_BREAKING_SPACES, ' ');
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatMeasure(value: number): string {
  return `${measureFormatter.format(value)} m`;
}

// D151/D160: presentation only. Persistence remains digits-only, and the
// length selects CPF (11 digits) or CNPJ (14 digits).
export function formatTaxId(taxId: string): string {
  const digits = taxId.trim();

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  return digits;
}
