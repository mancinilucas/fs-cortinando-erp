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
import { CreateQuoteCurtainDto } from './quote-curtain.dto.js';
import { QuoteDiscountDto } from './quote-discount.dto.js';
import { QuoteFinancialItemInputDto } from './quote-financial-item.dto.js';
import { QuoteInstallationAddressDto } from './quote-installation-address.dto.js';

// Body accepted by POST /clientes/:customerId/orcamentos (D79/D116).
// customerId comes from the route; quoteNumber, status, ids and timestamps are
// system-managed and are discarded by the whitelist.
export class CreateQuoteDto {
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
  @Type(() => CreateQuoteCurtainDto)
  curtains?: CreateQuoteCurtainDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteFinancialItemInputDto)
  generalAddOns?: QuoteFinancialItemInputDto[];
}
