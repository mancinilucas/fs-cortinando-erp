import { Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';
import { toDate, trimOptionalText } from './dto-transforms.js';

// Body accepted by POST /orcamentos/:id/enviar (D98/D116). When omitted, the
// aggregate applies the default validity of 30 days.
export class SendQuoteDto {
  @Transform(({ value }) => toDate(value))
  @IsOptional()
  @IsDate()
  validUntil?: Date | null;
}

// Body accepted by POST /orcamentos/:id/renovar (D101/D116). The new validity
// is required and must be strictly in the future; the aggregate enforces it.
export class RenewQuoteDto {
  @Transform(({ value }) => toDate(value))
  @IsDate()
  validUntil: Date;
}

// Body accepted by POST /orcamentos/:id/cancelar (D102/D116). The reason is
// optional and limited to 500 characters (D102).
export class CancelQuoteDto {
  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

// Body accepted by PUT /orcamentos/:id/instalacao (D104/D116). Past instants
// are accepted; lateness is derived.
export class ScheduleInstallationDto {
  @Transform(({ value }) => toDate(value))
  @IsDate()
  scheduledInstallationAt: Date;
}
