import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateBusinessDataDto } from './update-business-data.dto.js';

// Mirrors the global ValidationPipe from main.ts.
const pipe = new ValidationPipe({ whitelist: true, transform: true });

async function transform(payload: unknown): Promise<UpdateBusinessDataDto> {
  return (await pipe.transform(payload, {
    type: 'body',
    metatype: UpdateBusinessDataDto,
  })) as UpdateBusinessDataDto;
}

describe('UpdateBusinessDataDto', () => {
  it('normalizes fields before validation', async () => {
    const dto = await transform({
      commercialNameOrConsultant: '  Cortinando  ',
      phone: '  (11) 99999-9999  ',
      email: '  Contato@Example.COM ',
      taxId: '123.456.789-01',
    });

    expect(dto).toMatchObject({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
    });
  });

  it('turns absent, null and blank optional fields into null', async () => {
    const absent = await transform({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
    });

    expect(absent.email).toBeUndefined();
    expect(absent.taxId).toBeUndefined();

    const cleared = await transform({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: '   ',
      taxId: '   ',
    });

    expect(cleared).toMatchObject({ email: null, taxId: null });

    const nulled = await transform({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      email: null,
      taxId: null,
    });

    expect(nulled).toMatchObject({ email: null, taxId: null });
  });

  it.each([['commercialNameOrConsultant'], ['phone']])(
    'rejects a missing required field: %s',
    async (field) => {
      const payload: Record<string, unknown> = {
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
      };
      delete payload[field];

      await expect(transform(payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([['commercialNameOrConsultant'], ['phone']])(
    'rejects a null required field: %s',
    async (field) => {
      await expect(
        transform({
          commercialNameOrConsultant: 'Cortinando',
          phone: '11999999999',
          [field]: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([['commercialNameOrConsultant'], ['phone']])(
    'rejects a blank required field: %s',
    async (field) => {
      await expect(
        transform({
          commercialNameOrConsultant: 'Cortinando',
          phone: '11999999999',
          [field]: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects an invalid email', async () => {
    await expect(
      transform({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        email: 'not-an-email',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a tax id without 11 or 14 digits', async () => {
    await expect(
      transform({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        taxId: '1234567890',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('discards id, updatedAt and unknown fields', async () => {
    const dto = await transform({
      commercialNameOrConsultant: 'Cortinando',
      phone: '11999999999',
      id: 'business',
      updatedAt: '2026-10-20T12:00:00.000Z',
      unknown: 'value',
    });

    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('updatedAt');
    expect(dto).not.toHaveProperty('unknown');
  });
});
