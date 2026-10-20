import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  ValidateIf,
} from 'class-validator';
import { trimOptionalText } from './dto-transforms.js';

// FinancialItem payload shared by curtain components and general add-ons
// (D87/D88/D116). Quantities allow up to 6 decimals and money stays in
// integer cents; incomplete items are valid while the quote is a draft.
export class QuoteFinancialItemInputDto {
  @Transform(({ value }) => trimOptionalText(value))
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(999_999.999999)
  quantity?: number | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  unitPriceCents?: number | null;
}

// Edit payload (D117). A sent item without `id` is created; with a known id
// it is updated. Omitted scalars keep their value and null clears them, except
// `name`, which is required whenever it is sent.
export class QuoteFinancialItemUpdateDto {
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(999_999.999999)
  quantity?: number | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  unitPriceCents?: number | null;
}
