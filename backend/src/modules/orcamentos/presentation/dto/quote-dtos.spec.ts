import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CancelQuoteDto,
  RenewQuoteDto,
  ScheduleInstallationDto,
  SendQuoteDto,
} from './quote-action.dto.js';
import { CreateQuoteDto } from './create-quote.dto.js';
import {
  SearchQuotesQueryDto,
  QUOTE_SEARCH_STATUSES,
} from './search-quotes-query.dto.js';
import { UpdateQuoteDto } from './update-quote.dto.js';

// Mirrors the global ValidationPipe from main.ts (D68/D116).
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

const customerId = randomUUID();
const curtainId = randomUUID();
const componentId = randomUUID();

function validCreatePayload(): Record<string, unknown> {
  return {
    notes: '  Cliente preferencial  ',
    discount: { type: 'PERCENTAGE', percentage: 10 },
    commercialAdjustmentCents: -500,
    installationAddress: {
      postalCode: '01310-100',
      street: '  Avenida Paulista ',
      number: '1000',
      complement: '  Apto 10 ',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'sp',
    },
    curtains: [
      {
        room: 'Sala',
        description: 'Cortina principal',
        material: 'Linho',
        openingWidth: 2.5,
        borderValue: 0.15,
        height: 2.7,
        fabricFactor: 3.5,
        notes: '  Sem forro ',
        components: [
          {
            name: '  Tecido ',
            quantity: 8.05,
            unit: ' m ',
            unitPriceCents: 3_000,
          },
        ],
      },
    ],
    generalAddOns: [
      { name: 'Instalação', quantity: 1, unitPriceCents: 15_000 },
    ],
  };
}

describe('CreateQuoteDto', () => {
  it('normalizes and accepts a representative payload', async () => {
    const dto = await transform(validCreatePayload(), CreateQuoteDto);

    expect(dto.notes).toBe('Cliente preferencial');
    expect(dto.discount).toEqual({ type: 'PERCENTAGE', percentage: 10 });
    expect(dto.commercialAdjustmentCents).toBe(-500);
    expect(dto.installationAddress).toMatchObject({
      postalCode: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 10',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    expect(dto.curtains).toHaveLength(1);
    expect(dto.curtains?.[0]).toMatchObject({
      room: 'Sala',
      openingWidth: 2.5,
      borderValue: 0.15,
      height: 2.7,
      fabricFactor: 3.5,
      notes: 'Sem forro',
    });
    expect(dto.curtains?.[0]?.components?.[0]).toMatchObject({
      name: 'Tecido',
      quantity: 8.05,
      unit: 'm',
      unitPriceCents: 3_000,
    });
    expect(dto.generalAddOns?.[0]).toMatchObject({
      name: 'Instalação',
      quantity: 1,
      unitPriceCents: 15_000,
    });
  });

  it('accepts a minimal payload and null optional fields', async () => {
    await expect(transform({}, CreateQuoteDto)).resolves.toBeInstanceOf(
      CreateQuoteDto,
    );
    await expect(
      transform(
        {
          notes: null,
          discount: null,
          commercialAdjustmentCents: null,
          installationAddress: null,
          curtains: null,
          generalAddOns: null,
        },
        CreateQuoteDto,
      ),
    ).resolves.toBeInstanceOf(CreateQuoteDto);
  });

  it('discards system-managed fields from the body', async () => {
    const dto = await transform(
      {
        customerId,
        quoteNumber: 'ORÇ-2026-001',
        status: 'SENT',
        id: randomUUID(),
      },
      CreateQuoteDto,
    );

    for (const field of ['customerId', 'quoteNumber', 'status', 'id']) {
      expect(field in dto).toBe(false);
    }
  });

  it('rejects malformed collections and nested items', async () => {
    await expect(
      transform({ curtains: 'not-an-array' }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ curtains: [{ components: [{ name: '' }] }] }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { generalAddOns: [{ name: 'Tecido', quantity: 0 }] },
        CreateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { generalAddOns: [{ name: 'Tecido', quantity: 1.1234567 }] },
        CreateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { generalAddOns: [{ name: 'Tecido', unitPriceCents: 12.5 }] },
        CreateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid measures and money values', async () => {
    await expect(
      transform({ curtains: [{ openingWidth: -1 }] }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ curtains: [{ openingWidth: 1.2345 }] }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ curtains: [{ fabricFactor: '3.5' }] }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ commercialAdjustmentCents: 10.5 }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ commercialAdjustmentCents: 2_147_483_648 }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid installation addresses', async () => {
    await expect(
      transform({ installationAddress: { postalCode: '123' } }, CreateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { installationAddress: { state: 'São Paulo' } },
        CreateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the discount contract', async () => {
    const invalid = [
      { type: 'PERCENTAGE' },
      { type: 'PERCENTAGE', percentage: null },
      { type: 'PERCENTAGE', percentage: 0 },
      { type: 'PERCENTAGE', percentage: 100.01 },
      { type: 'PERCENTAGE', percentage: 10, fixedAmountCents: 500 },
      { type: 'PERCENTAGE', percentage: 10.123 },
      { type: 'FIXED_AMOUNT' },
      { type: 'FIXED_AMOUNT', fixedAmountCents: 0 },
      { type: 'FIXED_AMOUNT', fixedAmountCents: 1.5 },
      { type: 'FIXED_AMOUNT', fixedAmountCents: 500, percentage: 10 },
      { type: 'NO_DISCOUNT', percentage: 10 },
      { type: 'NO_DISCOUNT', fixedAmountCents: 500 },
      { type: 'UNKNOWN' },
    ];

    for (const discount of invalid) {
      await expect(
        transform({ discount }, CreateQuoteDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    await expect(
      transform({ discount: { type: 'NO_DISCOUNT' } }, CreateQuoteDto),
    ).resolves.toBeInstanceOf(CreateQuoteDto);
    await expect(
      transform(
        { discount: { type: 'FIXED_AMOUNT', fixedAmountCents: 500 } },
        CreateQuoteDto,
      ),
    ).resolves.toBeInstanceOf(CreateQuoteDto);
  });
});

describe('UpdateQuoteDto', () => {
  it('keeps omitted fields undefined and accepts null to clear them', async () => {
    const omitted = await transform({}, UpdateQuoteDto);

    expect(omitted.notes).toBeUndefined();
    expect(omitted.discount).toBeUndefined();
    expect(omitted.curtains).toBeUndefined();
    expect(omitted.generalAddOns).toBeUndefined();

    const cleared = await transform(
      { notes: null, discount: null, installationAddress: null },
      UpdateQuoteDto,
    );

    expect(cleared.notes).toBeNull();
    expect(cleared.discount).toBeNull();
    expect(cleared.installationAddress).toBeNull();
  });

  it('accepts nested ids and items without id', async () => {
    const dto = await transform(
      {
        curtains: [
          {
            id: curtainId,
            room: 'Sala',
            components: [{ id: componentId, name: 'Tecido', quantity: 8 }],
          },
          {
            room: 'Quarto',
            components: [{ name: 'Nova argola', unitPriceCents: 200 }],
          },
        ],
        generalAddOns: [{ name: 'Frete', unitPriceCents: 5_000 }],
      },
      UpdateQuoteDto,
    );

    expect(dto.curtains?.[0]?.id).toBe(curtainId);
    expect(dto.curtains?.[0]?.components?.[0]?.id).toBe(componentId);
    expect(dto.curtains?.[1]?.id).toBeUndefined();
    expect(dto.curtains?.[1]?.components?.[0]?.id).toBeUndefined();
    expect(dto.generalAddOns?.[0]?.id).toBeUndefined();
  });

  it('rejects unknown ids and cleared required names', async () => {
    await expect(
      transform({ curtains: [{ id: 'not-a-uuid' }] }, UpdateQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { generalAddOns: [{ id: randomUUID(), name: null }] },
        UpdateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { curtains: [{ components: [{ name: '   ', quantity: 1 }] }] },
        UpdateQuoteDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('discards customerId, quoteNumber and status', async () => {
    const dto = await transform(
      { customerId, quoteNumber: 'ORÇ-2026-001', status: 'SENT' },
      UpdateQuoteDto,
    );

    for (const field of ['customerId', 'quoteNumber', 'status']) {
      expect(field in dto).toBe(false);
    }
  });
});

describe('quote action DTOs', () => {
  it('accepts an optional ISO validity on send', async () => {
    const withDate = await transform(
      { validUntil: '2026-11-01T12:00:00.000Z' },
      SendQuoteDto,
    );

    expect(withDate.validUntil).toBeInstanceOf(Date);
    expect(withDate.validUntil?.toISOString()).toBe('2026-11-01T12:00:00.000Z');

    const withoutDate = await transform({}, SendQuoteDto);

    expect(withoutDate.validUntil).toBeUndefined();
  });

  it('requires a valid ISO validity on renew', async () => {
    await expect(transform({}, RenewQuoteDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      transform({ validUntil: '01/11/2026' }, RenewQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ validUntil: '2026-13-01T00:00:00Z' }, RenewQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);

    const dto = await transform(
      { validUntil: '2026-11-01T12:00:00.000Z' },
      RenewQuoteDto,
    );

    expect(dto.validUntil).toBeInstanceOf(Date);
  });

  it('bounds the cancellation reason and normalizes blanks', async () => {
    const blank = await transform({ reason: '   ' }, CancelQuoteDto);

    expect(blank.reason).toBeNull();
    await expect(
      transform({ reason: 'a'.repeat(500) }, CancelQuoteDto),
    ).resolves.toBeInstanceOf(CancelQuoteDto);
    await expect(
      transform({ reason: 'a'.repeat(501) }, CancelQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ reason: 10 }, CancelQuoteDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a valid ISO installation instant', async () => {
    await expect(transform({}, ScheduleInstallationDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      transform(
        { scheduledInstallationAt: 'tomorrow' },
        ScheduleInstallationDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const dto = await transform(
      { scheduledInstallationAt: '2026-10-25T09:00:00Z' },
      ScheduleInstallationDto,
    );

    expect(dto.scheduledInstallationAt).toBeInstanceOf(Date);
  });
});

describe('SearchQuotesQueryDto', () => {
  it('accepts the approved filters', async () => {
    for (const status of QUOTE_SEARCH_STATUSES) {
      await expect(
        transform({ search: 'alfa', status }, SearchQuotesQueryDto),
      ).resolves.toBeInstanceOf(SearchQuotesQueryDto);
    }
  });

  it('rejects malformed filters', async () => {
    await expect(
      transform({ status: 'INVALID' }, SearchQuotesQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform({ search: 10 }, SearchQuotesQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
