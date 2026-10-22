import { expect, test } from 'vitest'
import { discountTypeLabels, getLabel, historyEventLabels, quoteActionLabels, quoteStatusLabels } from './labels'
import { quoteStatusMetadata } from './status'

test('presents persisted and virtual statuses without calculating them', () => {
  expect(quoteStatusLabels.SENT).toBe('Enviado')
  expect(quoteStatusLabels.EXPIRED).toBe('Expirado')
  expect(quoteStatusLabels.IN_PRODUCTION).toBe('Em produção')
  expect(Object.keys(quoteStatusMetadata).sort()).toEqual(Object.keys(quoteStatusLabels).sort())
  expect(quoteStatusMetadata.EXPIRED.className).toContain('warning')
  expect(quoteStatusMetadata.CANCELLED.className).not.toContain('error')
  expect(quoteStatusMetadata.CONFIRMED.icon).not.toBe(quoteStatusMetadata.COMPLETED.icon)
})

test('labels discount types, history and actions', () => {
  expect(discountTypeLabels.NO_DISCOUNT).toBe('Sem desconto')
  expect(discountTypeLabels.FIXED_AMOUNT).toBe('Valor fixo')
  expect(historyEventLabels.INSTALLATION_REMOVED).toBe('Instalação removida')
  expect(historyEventLabels.PRODUCTION_ORDER_GENERATED).toBe('Ordem de produção gerada')
  expect(quoteActionLabels.send).toBe('Marcar como enviado')
})

test.each(['UNKNOWN', 'toString', '__proto__', '<script>'])('never exposes unknown code %s as a label', (code) => {
  expect(getLabel(historyEventLabels, code, 'Evento não identificado')).toBe('Evento não identificado')
})
