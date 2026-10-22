import { z } from 'zod'
import type { Dashboard } from './types'

const count = z.number().int().nonnegative()
const installationSchema = z.object({
  quoteId: z.string(),
  quoteNumber: z.string(),
  customerName: z.string(),
  scheduledInstallationAt: z.iso.datetime({ offset: true }),
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED']),
})

// Project only public contract fields; never derive status or installation groups.
export const dashboardSchema = z.object({
  statusCounts: z.object({ draft: count, sent: count, expired: count, confirmed: count, inProduction: count }),
  upcomingInstallations: z.array(installationSchema),
  weeklyInstallations: z.array(installationSchema),
  overdueInstallations: z.array(installationSchema),
}) satisfies z.ZodType<Dashboard>
