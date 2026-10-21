import { expect, test } from 'vitest'
import { historyDetailLines } from './history-details'
import type { QuoteHistoryEntry } from './types'

function entry(eventType: QuoteHistoryEntry['eventType'], details: unknown): QuoteHistoryEntry {
  return { id: 'event', eventType, occurredAt: '2026-10-01T12:00:00Z', details }
}
test('formats only known edit changes and locators without displaying opaque JSON', () => {
  expect(historyDetailLines(entry('QUOTE_EDITED', { changes: [
    { field: 'height', previous: 2.6, next: 2.65, curtainSequence: 2, curtainRoom: 'Sala' },
    { field: 'unitPriceCents', previous: 29, next: 101, componentName: 'Tecido' },
    { field: 'discountType', previous: 'NO_DISCOUNT', next: 'PERCENTAGE' },
    { field: 'commercialAdjustmentCents', previous: null, next: -1 },
    { field: 'futureSecret', previous: 'private', next: 'hidden' },
    { field: 'notes', previous: { secret: 'hidden' }, next: 'invalid' },
    { field: 'toString', previous: null, next: 'private' },
  ], internal: 'private' }))).toEqual([
    'Cortina 2 · Sala — Altura: 2,6 → 2,65', 'Componente Tecido — Preço unitário: R$ 0,29 → R$ 1,01',
    'Tipo de desconto: Sem desconto → Percentual', 'Ajuste comercial: Não informado → -R$ 0,01',
  ])
})
test.each([null, [], 'raw secret', { changes: 'private' }, { changes: [null, 1, {}, { field: 'unitPriceCents', previous: 0.5, next: 1 }] }])('ignores malformed or opaque edit details %#', (details) => {
  expect(historyDetailLines(entry('QUOTE_EDITED', details))).toEqual([])
})
test('reads only each event known fields and formats dates safely', () => {
  expect(historyDetailLines(entry('QUOTE_RENEWED', { previousValidUntil: '2026-10-01T12:00:00Z', newValidUntil: 'invalid', private: 'secret' }))).toEqual(['Validade anterior: 01/10/2026 às 09:00'])
  expect(historyDetailLines(entry('QUOTE_REOPENED', { previousConfirmedAt: null, previousScheduledInstallationAt: null }))).toEqual(['Confirmação anterior: Não informado', 'Instalação anterior: Não informado'])
  expect(historyDetailLines(entry('QUOTE_CANCELLED', { reason: 'Pedido da cliente', raw: 'secret' }))).toEqual(['Motivo: Pedido da cliente'])
  expect(historyDetailLines(entry('QUOTE_CONFIRMED', { reason: 'ignored' }))).toEqual([])
})
test.each(['INSTALLATION_SCHEDULED', 'INSTALLATION_CHANGED', 'INSTALLATION_REMOVED'] as const)('formats installation event %s without calculating lateness', (type) => {
  expect(historyDetailLines(entry(type, { previousScheduledInstallationAt: '2026-10-01T12:00:00Z', scheduledInstallationAt: '2026-10-02T12:00:00Z' })).join(' ')).toMatch(/10\/2026 às 09:00/)
})
