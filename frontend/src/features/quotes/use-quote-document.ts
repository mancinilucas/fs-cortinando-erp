import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/api-error'
import { getCommercialPdf, getProductionOrder } from './api'
import { GENERIC_ERROR_MESSAGE, getKnownErrorMessage } from '@/shared/errors/error-messages'
import { useToast } from '@/shared/components/toast-context'
import { quoteKeys } from './query-keys'
import type { QuoteDetail } from './types'

export type DocumentKind = 'commercial' | 'production'
export function useQuoteDocument(quote: QuoteDetail) {
  const toast = useToast()
  const client = useQueryClient()
  const active = useRef<AbortController | null>(null)
  const objectUrl = useRef<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ error: unknown; kind: DocumentKind }>()

  useEffect(() => () => {
    active.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  async function generate(kind: DocumentKind, delivery: 'open' | 'download') {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setPending(true); setFailure(undefined)
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null }
    try {
      const blob = await (kind === 'commercial' ? getCommercialPdf : getProductionOrder)(quote.id, controller.signal)
      if (controller.signal.aborted) return
      // The Blob stays outside the query cache. Only its temporary URL survives delivery.
      try {
        const url = URL.createObjectURL(blob)
        objectUrl.current = url
        const anchor = document.createElement('a')
        anchor.href = url
        if (delivery === 'download') {
          anchor.download = `${kind === 'commercial' ? 'orcamento' : 'ordem-producao'}-${quote.quoteNumber.replace(/[^\p{L}\p{N}_-]/gu, '-')}.pdf`
        } else {
          anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'
        }
        document.body.append(anchor); anchor.click(); anchor.remove()
        toast.success(delivery === 'open'
          ? 'Documento preparado. Se a nova aba não abrir, use a opção de baixar.'
          : 'Download do documento iniciado.')
      } finally {
        if (kind === 'production' || quote.status !== 'DRAFT') {
          const keys = [quoteKeys.history(quote.id), quoteKeys.detail(quote.id)]
          await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })))
          await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 409) setFailure({ error, kind })
      else toast.error(error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE)
      if (error instanceof ApiError && error.status === 409 && error.message === getKnownErrorMessage('Document is not available in the current status')) {
        await client.cancelQueries({ queryKey: quoteKeys.detail(quote.id) })
        await client.invalidateQueries({ queryKey: quoteKeys.detail(quote.id) })
      }
    } finally {
      if (!controller.signal.aborted) { active.current = null; setPending(false) }
    }
  }
  return { generate, pending, failure }
}
