import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  normalizeBusinessDataEmail,
  normalizeBusinessDataName,
  normalizeBusinessDataPhone,
  normalizeBusinessDataTaxId,
} from '../../application/business-data-normalizers.js';

// Body accepted by PUT /dados-do-negocio (D130). It is a full replacement:
// both required fields must be present and non-blank. System-managed fields
// (id, updatedAt) are intentionally absent and are discarded by the whitelist.
export class UpdateBusinessDataDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeBusinessDataName(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  commercialNameOrConsultant: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeBusinessDataPhone(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  phone: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeBusinessDataEmail(value) : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeBusinessDataTaxId(value) : value,
  )
  @IsOptional()
  @Matches(/^(\d{11}|\d{14})$/, {
    message: 'taxId must have 11 or 14 digits',
  })
  taxId?: string | null;
}
