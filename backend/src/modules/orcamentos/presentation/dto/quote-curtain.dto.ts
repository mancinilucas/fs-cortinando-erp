import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimOptionalText } from './dto-transforms.js';

// Editable curtain fields (D83–D86/D116). `sequence` is aggregate-owned and
// not accepted; the server derives it from the array order. Measures use at
// most 3 decimals and negative values are rejected. `clientRef` identifies a
// curtain created by the payload so its items can reference it before the
// server assigns the definitive id.
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

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientRef?: string | null;
}

export class CreateQuoteCurtainDto extends QuoteCurtainFieldsDto {}

// A sent curtains array is the complete collection (D117): items without `id`
// are created and known ids are reconciled; `clientRef` is accepted only for
// the new ones.
export class UpdateQuoteCurtainDto extends QuoteCurtainFieldsDto {
  @IsOptional()
  @IsUUID()
  id?: string | null;
}
