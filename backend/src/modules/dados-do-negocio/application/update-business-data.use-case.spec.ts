import {
  BusinessDataRecord,
  BusinessDataStore,
  BusinessDataValues,
} from './business-data-store.js';
import { BusinessDataValidationError } from './business-data-validation.error.js';
import { UpdateBusinessDataUseCase } from './update-business-data.use-case.js';

const STORED: BusinessDataRecord = {
  commercialNameOrConsultant: 'Cortinando',
  phone: '11999999999',
  email: 'contato@example.com',
  taxId: '12345678901',
  updatedAt: new Date('2026-10-20T12:00:00.000Z'),
};

class FakeBusinessDataStore extends BusinessDataStore {
  calls: BusinessDataValues[] = [];

  constructor(private readonly result: BusinessDataRecord = STORED) {
    super();
  }

  async find(): Promise<BusinessDataRecord | null> {
    return this.result;
  }

  async upsert(values: BusinessDataValues): Promise<BusinessDataRecord> {
    this.calls.push(values);

    return this.result;
  }
}

describe('UpdateBusinessDataUseCase', () => {
  it('normalizes and persists a complete input', async () => {
    const store = new FakeBusinessDataStore();
    const useCase = new UpdateBusinessDataUseCase(store);

    const result = await useCase.execute({
      commercialNameOrConsultant: '  Cortinando  ',
      phone: ' 11999999999 ',
      email: ' Contato@Example.COM ',
      taxId: '123.456.789-01',
    });

    expect(result).toBe(STORED);
    expect(store.calls).toHaveLength(1);
    expect(store.calls[0]).toEqual({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
  });

  it('turns omitted and blank optional fields into null', async () => {
    const store = new FakeBusinessDataStore();
    const useCase = new UpdateBusinessDataUseCase(store);

    await useCase.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: '   ',
      taxId: '',
    });

    expect(store.calls[0]).toMatchObject({ email: null, taxId: null });

    await useCase.execute({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
    });

    expect(store.calls[1]).toMatchObject({ email: null, taxId: null });
  });

  it('rejects a blank commercial name', async () => {
    const store = new FakeBusinessDataStore();
    const useCase = new UpdateBusinessDataUseCase(store);

    await expect(
      useCase.execute({
        commercialNameOrConsultant: '   ',
        phone: '11999999999',
      }),
    ).rejects.toBeInstanceOf(BusinessDataValidationError);
    expect(store.calls).toHaveLength(0);
  });

  it('rejects a blank phone', async () => {
    const store = new FakeBusinessDataStore();
    const useCase = new UpdateBusinessDataUseCase(store);

    await expect(
      useCase.execute({
        commercialNameOrConsultant: 'Cortinando',
        phone: '   ',
      }),
    ).rejects.toBeInstanceOf(BusinessDataValidationError);
    expect(store.calls).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const store = new FakeBusinessDataStore();
    const useCase = new UpdateBusinessDataUseCase(store);

    await expect(useCase.execute({})).rejects.toBeInstanceOf(
      BusinessDataValidationError,
    );
    expect(store.calls).toHaveLength(0);
  });

  it.each([['not-an-email'], ['missing@domain'], ['two@@example.com']])(
    'rejects an invalid email: %s',
    async (email) => {
      const store = new FakeBusinessDataStore();
      const useCase = new UpdateBusinessDataUseCase(store);

      await expect(
        useCase.execute({
          commercialNameOrConsultant: 'Cortinando',
          phone: '11999999999',
          email,
        }),
      ).rejects.toBeInstanceOf(BusinessDataValidationError);
      expect(store.calls).toHaveLength(0);
    },
  );

  it.each([['123'], ['1234567890'], ['123456789012'], ['123456789012345']])(
    'rejects a tax id without 11 or 14 digits: %s',
    async (taxId) => {
      const store = new FakeBusinessDataStore();
      const useCase = new UpdateBusinessDataUseCase(store);

      await expect(
        useCase.execute({
          commercialNameOrConsultant: 'Cortinando',
          phone: '11999999999',
          taxId,
        }),
      ).rejects.toBeInstanceOf(BusinessDataValidationError);
      expect(store.calls).toHaveLength(0);
    },
  );

  it.each([['12345678901'], ['12345678000190']])(
    'accepts a tax id with 11 or 14 digits: %s',
    async (taxId) => {
      const store = new FakeBusinessDataStore();
      const useCase = new UpdateBusinessDataUseCase(store);

      await useCase.execute({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        taxId,
      });

      expect(store.calls[0]).toMatchObject({ taxId });
    },
  );
});
