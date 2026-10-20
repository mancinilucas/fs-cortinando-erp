import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerOptionalText,
  normalizeCustomerPhone,
  normalizeCustomerTaxId,
} from '../../domain/customer-normalizers.js';
import { CustomerAddressDto } from './customer-address.dto.js';
import { normalizeString } from './dto-transforms.js';

// Body accepted by POST /clientes (D61). System-managed fields (id,
// timestamps) are intentionally absent and are discarded by the whitelist.
export class CreateCustomerDto {
  @Transform(({ value }) => normalizeString(value, normalizeCustomerName))
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) => normalizeString(value, normalizeCustomerPhone))
  @IsString()
  @IsNotEmpty()
  phone: string;

  @Transform(({ value }) => normalizeString(value, normalizeCustomerEmail))
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @Transform(({ value }) => normalizeString(value, normalizeCustomerTaxId))
  @IsOptional()
  @Matches(/^(\d{11}|\d{14})$/, {
    message: 'taxId must have 11 or 14 digits',
  })
  taxId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto | null;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsOptional()
  @IsString()
  notes?: string | null;
}
