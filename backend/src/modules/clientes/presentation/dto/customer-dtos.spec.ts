import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CustomerAddressDto } from './customer-address.dto.js';
import { CreateCustomerDto } from './create-customer.dto.js';
import { UpdateCustomerDto } from './update-customer.dto.js';

// Mirrors the global ValidationPipe from main.ts (D68).
const pipe = new ValidationPipe({ whitelist: true, transform: true });

async function transform<T>(
  payload: unknown,
  metatype: new () => T,
): Promise<T> {
  return (await pipe.transform(payload, {
    type: 'body',
    metatype,
  })) as T;
}

describe('CreateCustomerDto', () => {
  it('normalizes fields before validation', async () => {
    const dto = await transform(
      {
        name: '  Maria Silva  ',
        phone: '  (11) 99999-9999  ',
        email: '  MARIA@EXAMPLE.COM ',
        taxId: '123.456.789-01',
        address: {
          postalCode: '01310-100',
          street: '  Avenida Paulista ',
          number: ' 1000 ',
          complement: '  Apto 10 ',
          neighborhood: ' Bela Vista ',
          city: ' São Paulo ',
          state: 'sp',
        },
        notes: '  Cliente preferencial ',
      },
      CreateCustomerDto,
    );

    expect(dto).toMatchObject({
      name: 'Maria Silva',
      phone: '(11) 99999-9999',
      email: 'maria@example.com',
      taxId: '12345678901',
      address: {
        postalCode: '01310100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Apto 10',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      notes: 'Cliente preferencial',
    });
    expect(dto.address).toBeInstanceOf(CustomerAddressDto);
  });

  it('accepts a minimal payload and clears optional blanks', async () => {
    const dto = await transform(
      {
        name: 'Maria',
        phone: '11999999999',
        email: '   ',
        taxId: '',
        notes: '  ',
      },
      CreateCustomerDto,
    );

    expect(dto).toMatchObject({ name: 'Maria', email: null, taxId: null });
    expect(dto.notes).toBeNull();
    expect(dto.address).toBeUndefined();
  });

  it('accepts null for every optional field', async () => {
    const dto = await transform(
      {
        name: 'Maria',
        phone: '11999999999',
        email: null,
        taxId: null,
        address: null,
        notes: null,
      },
      CreateCustomerDto,
    );

    expect(dto).toMatchObject({
      email: null,
      taxId: null,
      address: null,
      notes: null,
    });
  });

  it('rejects missing or blank required fields', async () => {
    await expect(
      transform({ phone: '11999999999' }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ name: '   ', phone: '11999999999' }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ name: 'Maria' }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid formats', async () => {
    const valid = { name: 'Maria', phone: '11999999999' };

    await expect(
      transform({ ...valid, email: 'not-an-email' }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ ...valid, taxId: '1234567890' }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ ...valid, name: 123 }, CreateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid address block', async () => {
    const valid = { name: 'Maria', phone: '11999999999' };
    const addresses = [
      { street: 'Rua A', number: '1', city: 'São Paulo' },
      {
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        postalCode: '1234567',
      },
      {
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SPX',
      },
    ];

    for (const address of addresses) {
      await expect(
        transform({ ...valid, address }, CreateCustomerDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('discards system-managed fields', async () => {
    const dto = await transform(
      {
        id: '7a4b2c9e-0000-4000-8000-000000000000',
        createdAt: '2026-10-19T12:00:00.000Z',
        updatedAt: '2026-10-19T12:00:00.000Z',
        deletedAt: '2026-10-19T12:00:00.000Z',
        name: 'Maria',
        phone: '11999999999',
      },
      CreateCustomerDto,
    );

    expect(dto.name).toBe('Maria');
    expect(dto.phone).toBe('11999999999');
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
    expect(dto).not.toHaveProperty('deletedAt');
  });
});

describe('UpdateCustomerDto', () => {
  it('accepts an empty body as a no-op', async () => {
    await expect(transform({}, UpdateCustomerDto)).resolves.toEqual({});
  });

  it('keeps omitted fields undefined', async () => {
    const dto = await transform({ name: ' Maria ' }, UpdateCustomerDto);

    expect(dto.name).toBe('Maria');
    expect(dto.phone).toBeUndefined();
    expect(dto.email).toBeUndefined();
    expect(dto.address).toBeUndefined();
  });

  it('rejects null or blank required fields', async () => {
    await expect(
      transform({ name: null }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ name: '   ' }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ phone: null }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ phone: '' }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts null and blanks to clear optional fields', async () => {
    const cleared = await transform(
      { email: null, taxId: null, address: null, notes: null },
      UpdateCustomerDto,
    );

    expect(cleared).toMatchObject({
      email: null,
      taxId: null,
      address: null,
      notes: null,
    });

    const blank = await transform(
      { email: ' ', taxId: ' ', notes: ' ' },
      UpdateCustomerDto,
    );

    expect(blank).toMatchObject({ email: null, taxId: null, notes: null });
  });

  it('validates formats', async () => {
    await expect(
      transform({ email: 'not-an-email' }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ taxId: '123' }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a complete address and rejects a partial one', async () => {
    const dto = await transform(
      {
        address: {
          street: 'Rua A',
          number: '1',
          neighborhood: 'Centro',
          city: 'São Paulo',
        },
      },
      UpdateCustomerDto,
    );

    expect(dto.address).toBeInstanceOf(CustomerAddressDto);

    await expect(
      transform({ address: { city: 'São Paulo' } }, UpdateCustomerDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('discards system-managed fields', async () => {
    const dto = await transform(
      {
        id: '7a4b2c9e-0000-4000-8000-000000000000',
        createdAt: '2026-10-19T12:00:00.000Z',
        updatedAt: '2026-10-19T12:00:00.000Z',
        deletedAt: '2026-10-19T12:00:00.000Z',
        notes: 'VIP',
      },
      UpdateCustomerDto,
    );

    expect(dto.notes).toBe('VIP');
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
    expect(dto).not.toHaveProperty('deletedAt');
  });
});
