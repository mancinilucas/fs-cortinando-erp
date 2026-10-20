import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
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

// Body accepted by PATCH /clientes/:id (D62). Omitted fields stay unchanged;
// null or blank clears optional fields and is rejected for required ones.
export class UpdateCustomerDto {
  @Transform(({ value }) => normalizeString(value, normalizeCustomerName))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @Transform(({ value }) => normalizeString(value, normalizeCustomerPhone))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  phone?: string;

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
