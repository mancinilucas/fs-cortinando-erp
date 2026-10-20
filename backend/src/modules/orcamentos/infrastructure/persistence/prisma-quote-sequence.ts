import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';

// Atomic annual quote-number sequence (D80/D81). The increment is a single
// PostgreSQL statement, so concurrent reservations never repeat a number. The
// method accepts a transaction client so the reservation can roll back with
// the quote creation that consumed it (D119); gaps left by rollbacks are
// accepted.

interface SequenceRow {
  last_number: number;
}

@Injectable()
export class PrismaQuoteSequence {
  constructor(private readonly prisma: PrismaService) {}

  async reserveInTransaction(
    client: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    if (!Number.isSafeInteger(year) || year < 1) {
      throw new RangeError('Quote sequence year must be a positive integer');
    }

    const rows = await client.$queryRaw<SequenceRow[]>`
      INSERT INTO quote_sequence (year, last_number)
      VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE
        SET last_number = quote_sequence.last_number + 1
      RETURNING last_number
    `;

    const row = rows[0];

    if (row === undefined) {
      throw new Error('Quote sequence reservation returned no value');
    }

    return row.last_number;
  }
}
