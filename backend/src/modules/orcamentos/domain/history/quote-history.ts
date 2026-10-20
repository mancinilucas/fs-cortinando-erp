// History contracts for the Quote module (D108/D109). History is not part of
// the aggregate and is written by the Application in the same transaction as
// the state change. These builders only shape the `details` payload; they do
// not persist anything or emit events.

export type QuoteHistoryEventType =
  | 'QUOTE_CREATED'
  | 'QUOTE_SENT'
  | 'QUOTE_EDITED'
  | 'QUOTE_CONFIRMED'
  | 'QUOTE_REOPENED'
  | 'QUOTE_RENEWED'
  | 'QUOTE_CANCELLED'
  | 'PRODUCTION_STARTED'
  | 'INSTALLATION_SCHEDULED'
  | 'INSTALLATION_CHANGED'
  | 'INSTALLATION_REMOVED'
  | 'SERVICE_COMPLETED';

export type JsonPrimitive = string | number | boolean | null;

export interface QuoteCreatedDetails {
  quoteNumber: string;
}

export interface QuoteSentDetails {
  validUntil: string;
  firstSend: true;
}

// A flat change within a single saved edit (D109). Locator fields point to the
// curtain/component the change belongs to; there is no nested per-component
// diff.
export interface QuoteEditChange {
  field: string;
  previous: JsonPrimitive;
  next: JsonPrimitive;
  curtainSequence?: number;
  curtainRoom?: string | null;
  componentName?: string | null;
}

export interface QuoteEditedDetails {
  changes: QuoteEditChange[];
}

export interface QuoteReopenedDetails {
  previousConfirmedAt: string | null;
  previousScheduledInstallationAt: string | null;
}

export interface QuoteRenewedDetails {
  previousValidUntil: string;
  newValidUntil: string;
}

export interface QuoteCancelledDetails {
  reason?: string;
}

export interface InstallationScheduledDetails {
  scheduledInstallationAt: string;
}

export interface InstallationChangedDetails {
  previousScheduledInstallationAt: string;
  scheduledInstallationAt: string;
}

export interface InstallationRemovedDetails {
  previousScheduledInstallationAt: string;
}

export interface QuoteHistoryDetailsMap {
  QUOTE_CREATED: QuoteCreatedDetails;
  QUOTE_SENT: QuoteSentDetails;
  QUOTE_EDITED: QuoteEditedDetails;
  QUOTE_CONFIRMED: undefined;
  QUOTE_REOPENED: QuoteReopenedDetails;
  QUOTE_RENEWED: QuoteRenewedDetails;
  QUOTE_CANCELLED: QuoteCancelledDetails;
  PRODUCTION_STARTED: undefined;
  INSTALLATION_SCHEDULED: InstallationScheduledDetails;
  INSTALLATION_CHANGED: InstallationChangedDetails;
  INSTALLATION_REMOVED: InstallationRemovedDetails;
  SERVICE_COMPLETED: undefined;
}

export type QuoteHistoryEventDraft = {
  [T in QuoteHistoryEventType]: QuoteHistoryDetailsMap[T] extends undefined
    ? { type: T; details?: undefined }
    : { type: T; details: QuoteHistoryDetailsMap[T] };
}[QuoteHistoryEventType];

export const QuoteHistoryDetails = {
  created(quoteNumber: string): QuoteCreatedDetails {
    return { quoteNumber };
  },

  sent(validUntil: Date): QuoteSentDetails {
    return { validUntil: toIso(validUntil), firstSend: true };
  },

  edited(changes: QuoteEditChange[]): QuoteEditedDetails {
    return { changes };
  },

  reopened(
    previousConfirmedAt: Date | null,
    previousScheduledInstallationAt: Date | null,
  ): QuoteReopenedDetails {
    return {
      previousConfirmedAt: toIsoOrNull(previousConfirmedAt),
      previousScheduledInstallationAt: toIsoOrNull(
        previousScheduledInstallationAt,
      ),
    };
  },

  renewed(previousValidUntil: Date, newValidUntil: Date): QuoteRenewedDetails {
    return {
      previousValidUntil: toIso(previousValidUntil),
      newValidUntil: toIso(newValidUntil),
    };
  },

  cancelled(reason: string | null): QuoteCancelledDetails {
    return reason === null ? {} : { reason };
  },

  installationScheduled(
    scheduledInstallationAt: Date,
  ): InstallationScheduledDetails {
    return { scheduledInstallationAt: toIso(scheduledInstallationAt) };
  },

  installationChanged(
    previousScheduledInstallationAt: Date,
    scheduledInstallationAt: Date,
  ): InstallationChangedDetails {
    return {
      previousScheduledInstallationAt: toIso(previousScheduledInstallationAt),
      scheduledInstallationAt: toIso(scheduledInstallationAt),
    };
  },

  installationRemoved(
    previousScheduledInstallationAt: Date,
  ): InstallationRemovedDetails {
    return {
      previousScheduledInstallationAt: toIso(previousScheduledInstallationAt),
    };
  },
};

function toIso(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('History timestamp must be a valid date');
  }

  return instant.toISOString();
}

function toIsoOrNull(instant: Date | null): string | null {
  return instant === null ? null : toIso(instant);
}
