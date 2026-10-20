import { BusinessDataNotFoundError } from './business-data-not-found.error.js';
import {
  BusinessDataRecord,
  BusinessDataStore,
} from './business-data-store.js';
import { GetBusinessDataQuery } from './get-business-data.query.js';

const RECORD: BusinessDataRecord = {
  commercialNameOrConsultant: 'Cortinando',
  phone: '11999999999',
  email: 'contato@example.com',
  taxId: '12345678901',
  updatedAt: new Date('2026-10-20T12:00:00.000Z'),
};

class FakeBusinessDataStore extends BusinessDataStore {
  constructor(private readonly record: BusinessDataRecord | null) {
    super();
  }

  async find(): Promise<BusinessDataRecord | null> {
    return this.record;
  }

  async upsert(): Promise<BusinessDataRecord> {
    throw new Error('not used in query tests');
  }
}

describe('GetBusinessDataQuery', () => {
  it('returns the configured business data', async () => {
    const query = new GetBusinessDataQuery(new FakeBusinessDataStore(RECORD));

    await expect(query.execute()).resolves.toBe(RECORD);
  });

  it('throws when the business data is not configured', async () => {
    const query = new GetBusinessDataQuery(new FakeBusinessDataStore(null));

    await expect(query.execute()).rejects.toBeInstanceOf(
      BusinessDataNotFoundError,
    );
  });
});
