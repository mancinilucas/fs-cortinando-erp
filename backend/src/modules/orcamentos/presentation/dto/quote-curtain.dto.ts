import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimOptionalText } from './dto-transforms.js';
import {
  QuoteFinancialItemInputDto,
  QuoteFinancialItemUpdateDto,
} from './quote-financial-item.dto.js';

// Editable curtain fields (D83–D86/D116). `sequence` is aggregate-owned and
// not accepted; the server derives it from the array order. Measures use at
// most 3 decimals and negative values are rejected.
class QuoteCurtainFieldsDto {
  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  room?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  description?: string | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  material?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999_999.999)
  openingWidth?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999.999)
  borderValue?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999_999.999)
  height?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999.999)
  fabricFactor?: number | null;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateQuoteCurtainDto extends QuoteCurtainFieldsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteFinancialItemInputDto)
  components?: QuoteFinancialItemInputDto[];
}

// A sent curtains array is the complete collection (D117). Items without `id`
// are created and known ids are reconciled; `components` follows the same
// collection rule inside each curtain.
export class UpdateQuoteCurtainDto extends QuoteCurtainFieldsDto {
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteFinancialItemUpdateDto)
  components?: QuoteFinancialItemUpdateDto[];
}
