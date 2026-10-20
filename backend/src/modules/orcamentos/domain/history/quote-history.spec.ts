import { describe, expect, it } from 'vitest';
import {
  QuoteHistoryDetails,
  type QuoteEditChange,
  type QuoteHistoryEventDraft,
} from './quote-history.js';

const at = new Date('2026-10-20T12:00:00.000Z');
const later = new Date('2026-11-19T12:00:00.000Z');

describe('Quote history details', () => {
  it('builds the QUOTE_CREATED payload', () => {
    expect(QuoteHistoryDetails.created('ORÇ-2026-001')).toEqual({
      quoteNumber: 'ORÇ-2026-001',
    });
  });

  it('builds the QUOTE_SENT payload with the applied validity', () => {
    expect(QuoteHistoryDetails.sent(later)).toEqual({
      validUntil: '2026-11-19T12:00:00.000Z',
      firstSend: true,
    });
  });

  it('builds the QUOTE_EDITED payload preserving optional locators', () => {
    const changes: QuoteEditChange[] = [
      {
        field: 'height',
        previous: 2.6,
        next: 2.65,
        curtainSequence: 1,
        curtainRoom: 'Sala',
      },
      {
        field: 'unitPriceCents',
        previous: 3_000,
        next: 3_200,
        curtainSequence: 1,
        curtainRoom: 'Sala',
        componentName: 'Tecido',
      },
      {
        field: 'notes',
        previous: null,
        next: 'Cliente pediu urgência',
      },
    ];

    expect(QuoteHistoryDetails.edited(changes)).toEqual({ changes });
  });

  it('builds the QUOTE_REOPENED payload with previous values', () => {
    expect(QuoteHistoryDetails.reopened(at, later)).toEqual({
      previousConfirmedAt: '2026-10-20T12:00:00.000Z',
      previousScheduledInstallationAt: '2026-11-19T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.reopened(at, null)).toEqual({
      previousConfirmedAt: '2026-10-20T12:00:00.000Z',
      previousScheduledInstallationAt: null,
    });
    expect(QuoteHistoryDetails.reopened(null, null)).toEqual({
      previousConfirmedAt: null,
      previousScheduledInstallationAt: null,
    });
  });

  it('builds the QUOTE_RENEWED payload', () => {
    expect(QuoteHistoryDetails.renewed(at, later)).toEqual({
      previousValidUntil: '2026-10-20T12:00:00.000Z',
      newValidUntil: '2026-11-19T12:00:00.000Z',
    });
  });

  it('builds the QUOTE_CANCELLED payload with an optional reason', () => {
    expect(QuoteHistoryDetails.cancelled('Cliente desistiu')).toEqual({
      reason: 'Cliente desistiu',
    });
    expect(QuoteHistoryDetails.cancelled(null)).toEqual({});
  });

  it('builds the installation payloads', () => {
    expect(QuoteHistoryDetails.installationScheduled(later)).toEqual({
      scheduledInstallationAt: '2026-11-19T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.installationChanged(at, later)).toEqual({
      previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
      scheduledInstallationAt: '2026-11-19T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.installationRemoved(at)).toEqual({
      previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
    });
  });

  it('rejects invalid timestamps', () => {
    const invalid = new Date(Number.NaN);

    expect(() => QuoteHistoryDetails.sent(invalid)).toThrow(RangeError);
    expect(() => QuoteHistoryDetails.renewed(invalid, later)).toThrow(
      RangeError,
    );
    expect(() => QuoteHistoryDetails.installationScheduled(invalid)).toThrow(
      RangeError,
    );
    expect(() => QuoteHistoryDetails.reopened(invalid, null)).toThrow(
      RangeError,
    );
  });

  it('models events without details with an absent details field', () => {
    const events: QuoteHistoryEventDraft[] = [
      { type: 'QUOTE_CONFIRMED' },
      { type: 'PRODUCTION_STARTED' },
      { type: 'SERVICE_COMPLETED' },
      {
        type: 'QUOTE_CREATED',
        details: { quoteNumber: 'ORÇ-2026-001' },
      },
      {
        type: 'QUOTE_SENT',
        details: { validUntil: '2026-11-19T12:00:00.000Z', firstSend: true },
      },
      { type: 'QUOTE_EDITED', details: { changes: [] } },
      {
        type: 'QUOTE_REOPENED',
        details: {
          previousConfirmedAt: null,
          previousScheduledInstallationAt: null,
        },
      },
      {
        type: 'QUOTE_RENEWED',
        details: {
          previousValidUntil: '2026-10-20T12:00:00.000Z',
          newValidUntil: '2026-11-19T12:00:00.000Z',
        },
      },
      { type: 'QUOTE_CANCELLED', details: {} },
      {
        type: 'INSTALLATION_SCHEDULED',
        details: { scheduledInstallationAt: '2026-11-19T12:00:00.000Z' },
      },
      {
        type: 'INSTALLATION_CHANGED',
        details: {
          previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
          scheduledInstallationAt: '2026-11-19T12:00:00.000Z',
        },
      },
      {
        type: 'INSTALLATION_REMOVED',
        details: {
          previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
        },
      },
    ];

    expect(events).toHaveLength(12);
    expect(events[0].details).toBeUndefined();
  });
});
