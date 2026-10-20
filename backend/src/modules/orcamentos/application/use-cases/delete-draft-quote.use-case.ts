import { Injectable } from '@nestjs/common';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';

export interface DeleteDraftQuoteInput {
  id: string;
}

/**
 * Physical deletion of a DRAFT (D110). Children and history are removed by
 * cascade; no history event survives, and the consumed number is not
 * returned to the yearly sequence.
 */
@Injectable()
export class DeleteDraftQuoteUseCase {
  constructor(private readonly quotes: QuoteRepository) {}

  async execute(input: DeleteDraftQuoteInput): Promise<void> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    quote.assertDraftForDeletion();

    const deleted = await this.quotes.deleteDraft(input.id);

    if (deleted) {
      return;
    }

    // D120: a concurrent transition may have changed the status after the
    // aggregate was loaded; the conditional delete then removes nothing.
    const current = await this.quotes.findById(input.id);

    if (current === null) {
      throw new QuoteNotFoundError();
    }

    throw new InvalidQuoteTransitionError('Only draft quotes can be deleted');
  }
}
