export const customerKeys = {
  all: ['customers'] as const,
  lists: () => ['customers', 'list'] as const,
  list: (search: string) => ['customers', 'list', search] as const,
  detail: (id: string | undefined) => ['customers', 'detail', id] as const,
  history: (id: string | undefined) => ['customers', 'history', id] as const,
}

// Quote list consumers must use this prefix so customer-name changes invalidate summaries.
export const quoteSummariesQueryKey = ['quotes', 'list'] as const
