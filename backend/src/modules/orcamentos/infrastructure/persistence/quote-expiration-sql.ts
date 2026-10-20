import { Prisma } from '../../../../generated/prisma/client.js';

// D106: EXPIRED is virtual and must never be persisted. These fragments are the
// single read-side definition of expired and valid SENT quotes. Both assume the
// quote table is aliased as `q`.

export function expiredQuoteCondition(now: Date): Prisma.Sql {
  return Prisma.sql`(q.status::text = 'SENT' AND q.valid_until IS NOT NULL AND q.valid_until < ${now})`;
}

export function validSentQuoteCondition(now: Date): Prisma.Sql {
  return Prisma.sql`(q.status::text = 'SENT' AND (q.valid_until IS NULL OR q.valid_until >= ${now}))`;
}
