import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import {
  normalizeCustomerOptionalText,
  normalizeCustomerPostalCode,
  normalizeCustomerState,
} from '../../domain/customer-normalizers.js';
import { normalizeString } from './dto-transforms.js';

// Address block accepted by create and update (D53–D55). When the block is
// present, street, number, neighborhood and city are required (D54-A).
export class CustomerAddressDto {
  @Transform(({ value }) => normalizeString(value, normalizeCustomerPostalCode))
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'postalCode must have exactly 8 digits' })
  postalCode?: string | null;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsString()
  street: string;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsString()
  number: string;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsOptional()
  @IsString()
  complement?: string | null;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsString()
  neighborhood: string;

  @Transform(({ value }) =>
    normalizeString(value, normalizeCustomerOptionalText),
  )
  @IsString()
  city: string;

  @Transform(({ value }) => normalizeString(value, normalizeCustomerState))
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'state must be 2 uppercase letters' })
  state?: string | null;
}
