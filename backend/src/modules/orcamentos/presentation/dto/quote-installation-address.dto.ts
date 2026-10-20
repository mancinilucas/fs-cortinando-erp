import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import {
  normalizePostalCode,
  normalizeState,
  trimOptionalText,
} from './dto-transforms.js';

// Installation address snapshot (D94/D95/D116). Every field is optional so a
// draft may keep a partial address; completeness is enforced by the send gate.
export class QuoteInstallationAddressDto {
  @Transform(({ value }) => normalizePostalCode(value))
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'postalCode must have exactly 8 digits' })
  postalCode?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  street?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  number?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  complement?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  city?: string | null;

  @Transform(({ value }) => normalizeState(value))
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'state must be 2 uppercase letters' })
  state?: string | null;
}
