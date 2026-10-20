import { BusinessDataResponseMapper } from './business-data-response.mapper.js';

describe('BusinessDataResponseMapper', () => {
  it('maps the record without exposing the id and with ISO updatedAt', () => {
    const mapped = BusinessDataResponseMapper.toResponse({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
      updatedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    expect(mapped).toEqual({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: 'contato@example.com',
      taxId: '12345678901',
      updatedAt: '2026-10-20T12:00:00.000Z',
    });
    expect(mapped).not.toHaveProperty('id');
  });

  it('keeps optional fields as null when not configured', () => {
    const mapped = BusinessDataResponseMapper.toResponse({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: null,
      taxId: null,
      updatedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    expect(mapped.email).toBeNull();
    expect(mapped.taxId).toBeNull();
  });
});
