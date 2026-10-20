import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimOptionalText } from './dto-transforms.js';
import { UpdateQuoteCurtainDto } from './quote-curtain.dto.js';
import { QuoteDiscountDto } from './quote-discount.dto.js';
import { QuoteFinancialItemUpdateDto } from './quote-financial-item.dto.js';
import { QuoteInstallationAddressDto } from './quote-installation-address.dto.js';

// Body accepted by PATCH /orcamentos/:id (D116/D117). A truly partial patch:
// an omitted field stays unchanged, null clears it when absence is allowed,
// and a sent collection represents its complete state.
export class UpdateQuoteDto {
  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteDiscountDto)
  discount?: QuoteDiscountDto | null;

  @IsOptional()
  @IsInt()
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  commercialAdjustmentCents?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteInstallationAddressDto)
  installationAddress?: QuoteInstallationAddressDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateQuoteCurtainDto)
  curtains?: UpdateQuoteCurtainDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteFinancialItemUpdateDto)
  generalAddOns?: QuoteFinancialItemUpdateDto[];
}
